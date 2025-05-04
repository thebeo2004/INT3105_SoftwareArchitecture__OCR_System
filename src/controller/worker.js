import { kafka, RECEIVED_TOPIC } from "../config/kafka.js";
import path from 'path';
import { process as processFile } from "../utils/serve.js";
import { filesProcessedTotal, ocrPagesProcessedTotal } from "../middlewares/measurement.js";
import express from 'express';
import client from 'prom-client';

const consumer = kafka.consumer({
    groupId: 'ocr-worker-group'
});




const run = async () => {
    await consumer.connect();
    await consumer.subscribe({ topic: RECEIVED_TOPIC, fromBeginning: true });

    console.log(`OCR Worker connected and listening to topic: ${RECEIVED_TOPIC}`);

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            console.log(`Received message from ${topic} partition ${partition}`);
            let filePath = '';

            try {
                const payload = JSON.parse(message.value.toString());
                filePath = payload.filePath;

                if (!filePath) {
                    throw new Error(`File path missing in message payload.`);
                }

                console.log(`Processing file via serve.js: ${filePath}`);

                // Call the centralized processing function from serve.js
                const resultPdfPath = await processFile(filePath);

                // --- Success ---
                filesProcessedTotal.inc(); // Increment total processed files counter
                console.log(`Successfully processed ${path.basename(filePath)}. Result PDF: ${resultPdfPath}`);

                // Optional: Send results to another Kafka topic if needed

            } catch (error) {
                // --- Error ---
                // Specific errors (OCR, PDF, Translate, File Read) are logged and counted within processFile
                console.error(`Worker failed to process message for file ${filePath || 'unknown'}:`, error.message);
                // Consider adding a worker-specific error metric if needed
                // workerProcessingErrorsTotal.inc();
            }
        },
    });

    // Graceful shutdown setup
    const errorTypes = ['unhandledRejection', 'uncaughtException'];
    const signalTraps = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

    errorTypes.forEach(type => {
        process.on(type, async e => {
            try {
                console.log(`process.on ${type}`);
                console.error(e);
                await consumer.disconnect();
                process.exit(0);
            } catch (_) {
                process.exit(1);
            }
        });
    });

    signalTraps.forEach(type => {
        process.once(type, async () => {
            try {
                console.log(`Signal ${type} received. Shutting down gracefully.`);
                await consumer.disconnect();
            } finally {
                process.kill(process.pid, type);
            }
        });
    });
};

run().catch(e => console.error('[OCR Worker] Error starting worker:', e));