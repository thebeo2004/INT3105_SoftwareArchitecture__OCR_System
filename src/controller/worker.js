import { kafka, RECEIVED_TOPIC } from "../config/kafka.js";
import path from 'path';
import express from 'express';
import client from "prom-client";
import { process as processFile } from "../utils/serve.js";
import { createClient as createRedisClient } from "redis";

import { filesProcessedTotal, 
        ocrPagesProcessedTotal,
        ocrProcessingDurationSeconds,
        pdfCreationDurationSeconds,
        translationDurationSeconds,
        ocrErrorsTotal,         
        pdfCreationErrorsTotal, 
        translationErrorsTotal, 
        cacheHitTotal,
        cacheMissTotal,
        totalProcessingDurationSeconds
 } from "../middlewares/measurement.js";

const WORKER_METRICS_PORT = 5001; // Define a port for worker metrics

const UPLOADS_DIR = process.env.UPLOADS_DIR || '/app/uploads';
export const OUTPUT_DIR = process.env.OUTPUT_DIR || '/app/output';
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';

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
workerRegister.registerMetric(cacheHitTotal);
workerRegister.registerMetric(cacheMissTotal);
workerRegister.registerMetric(totalProcessingDurationSeconds);

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
let redisClient;

const consumer = kafka.consumer({ 
    groupId: 'ocr-worker-group',
    sessionTimeout: 30000, // Set session timeout to 30 seconds
    heartbeatInterval: 3000, // Set heartbeat interval to 3 seconds
    retry: {
        retries: 5, // Retry up to 5 times on failure
        initialRetryTime: 300, // Initial retry time in ms
    }
});

const run = async () => {

    // Initialize Redis Client
    try {
        redisClient = createRedisClient({ url: REDIS_URL });
        redisClient.on('error', (err) => console.error('[REDIS] Redis Client Error', err));
        await redisClient.connect();
        console.log('[REDIS] Connected to Redis successfully');
    } catch (err) {
        console.error('[REDIS] Could not connect to Redis:', err);
        process.exit(1);
    }

    try {

        workerServer = workerApp.listen(WORKER_METRICS_PORT, () => {
            console.log(`Worker metrics server listening on port ${WORKER_METRICS_PORT}`);
            console.log(`Worker metrics available at http://worker:${WORKER_METRICS_PORT}/metrics`);
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
            console.log(`Received message from topic ${topic}`);
            const rawValue = message.value.toString();
            let payload;
            try {
                payload = JSON.parse(rawValue);
            } catch (e) {
                console.error("Error parsing Kafka message:", e);
                return; 
            }

            const filename = payload.filename; // Get filename from payload

            if (!filename) {
                console.error("Message payload does not contain a filename.");
                return;
            }

            const inputPath = path.join(UPLOADS_DIR, filename);
            console.log(`Processing file: ${inputPath}`);

            try {
                // Pass the container-internal path to the process function
                const outputFilename = await processFile(inputPath, redisClient);
                
                filesProcessedTotal.inc(); // Increment counter on successful processing
                console.log(`Successfully processed ${filename}, output: ${outputFilename}`);
                
                // Optionally send a message about the result (e.g., to OUTPUT_TOPIC)
                // await sendResultToKafka(producer, { originalFilename: filename, pdfPath: path.join(OUTPUT_DIR, outputFilename) });

            } catch (error) {
                console.error(`Error processing file ${inputPath}:`, error);
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