import { kafka, RECEIVED_TOPIC } from "../config/kafka.js";
import path from 'path';
import express from 'express';
import client from "prom-client";
import { process as processFile } from "../utils/serve.js";
import { filesProcessedTotal, 
        ocrPagesProcessedTotal,
        ocrProcessingDurationSeconds,
        pdfCreationDurationSeconds,
        translationDurationSeconds,
        ocrErrorsTotal,         
        pdfCreationErrorsTotal, 
        translationErrorsTotal, 
 } from "../middlewares/measurement.js";

const WORKER_METRICS_PORT = 5001; // Define a port for worker metrics


const workerApp = express();
const workerRegister = new client.Registry();
client.collectDefaultMetrics({ register: workerRegister, prefix: 'worker_' });

// Register the metrics
workerRegister.registerMetric(filesProcessedTotal);
workerRegister.registerMetric(ocrPagesProcessedTotal);
workerRegister.registerMetric(ocrProcessingDurationSeconds);
workerRegister.registerMetric(pdfCreationDurationSeconds);
workerRegister.registerMetric(translationDurationSeconds);
workerRegister.registerMetric(ocrErrorsTotal);
workerRegister.registerMetric(pdfCreationErrorsTotal);
workerRegister.registerMetric(translationErrorsTotal);

workerApp.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', workerRegister.contentType);
        res.end(await workerRegister.metrics());
    } catch (ex) {
        console.error("Error serving worker metrics:", ex);
        res.status(500).end(ex);
    }
});

let workerServer;

const consumer = kafka.consumer({ 
    groupId: 'ocr-worker-group'
});

const run = async () => {

    try {

        workerServer = workerApp.listen(WORKER_METRICS_PORT, () => {
            console.log(`Worker metrics server listening on port ${WORKER_METRICS_PORT}`);
            console.log(`Worker metrics available at http://localhost:${WORKER_METRICS_PORT}/metrics`);
        });

        workerServer.on('error', (err) => {
             console.error(`[Worker Metrics Server] Error starting server on port ${WORKER_METRICS_PORT}:`, err);
             process.exit(1); // Exit if metrics server fails to start
        });
    } catch (err) { // Catch synchronous errors during listen setup
         console.error(`[Worker Metrics Server] Failed to setup listen:`, err);
         process.exit(1);
    }

    await consumer.connect();
    await consumer.subscribe({ topic: RECEIVED_TOPIC, fromBeginning: true });

    console.log(`OCR Worker connected and listening to Kafka topic: ${RECEIVED_TOPIC}`);

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

                const resultPdfPath = await processFile(filePath);

                filesProcessedTotal.inc();
                ocrPagesProcessedTotal.inc();
                console.log(`Successfully processed ${path.basename(filePath)}. Result PDF: ${resultPdfPath}`);

            } catch (error) {
                console.error(`Worker failed to process message for file ${filePath || 'unknown'}:`, error.message);
            }
        },
    });

    // Graceful shutdown setup
    const errorTypes = ['unhandledRejection', 'uncaughtException'];
    const signalTraps = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

    const shutdown = async (signalOrErrorType, error) => {
        console.log(`Shutting down worker due to ${signalOrErrorType}...`);
        if (error) {
            console.error(error);
        }
        try {
            await consumer.disconnect();
            console.log('Kafka consumer disconnected.');
            if (workerServer) {
                // Close the server gracefully
                await new Promise((resolve, reject) => {
                    workerServer.close((err) => {
                        if (err) {
                            console.error('Error closing worker metrics server:', err);
                            return reject(err);
                        }
                        console.log('Worker metrics server closed.');
                        resolve();
                    });
                });
            }
        } catch (e) {
            console.error('Error during shutdown:', e);
            process.exitCode = 1; // Indicate error exit
        } finally {
            console.log('Worker shutdown complete.');
            // If triggered by signal, re-kill with the signal for Docker compatibility
            if (signalTraps.includes(signalOrErrorType)) {
                 process.kill(process.pid, signalOrErrorType);
            } else {
                 process.exit(error ? 1 : 0); // Exit with 1 on error, 0 otherwise
            }
        }
    };

    errorTypes.forEach(type => {
        process.on(type, (error) => shutdown(type, error));
    });

    signalTraps.forEach(type => {
        // Ensure the listener is removed after first signal
        process.once(type, () => shutdown(type));
    });
};

run().catch(e => {
    console.error('[OCR Worker] Error starting worker:', e);
    if (workerServer) {
        workerServer.close(() => process.exit(1));
    } else {
        process.exit(1);
    }
});