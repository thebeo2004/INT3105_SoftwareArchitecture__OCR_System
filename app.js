import express from "express";
import client from 'prom-client';
import { Kafka } from "kafkajs";

// import {process} from "./src/utils/serve.js"
import { sending_msg } from "./src/config/kafka.js"
import { upload } from "./src/config/multer.js";
import { 
    httpRequestDurationMicroseconds, 
    httpRequestErrorsTotal, 
    httpRequestsInProgress,  
    uploadedFileSizeHistogram,    
} from "./src/middlewares/measurement.js";

const app = express();
const kafka = new Kafka({
    clientId: 'upload-app-producer',
    brokers: ['localhost:9092']
});
const producer = kafka.producer();

// -- Prometheus Metrics Setup ---
const collectDefaultMetrics = client.collectDefaultMetrics;
const Registry = client.Registry;
const register = new Registry();
collectDefaultMetrics({ register }); // Collect default Node.js metrics

// Register only metrics relevant to the web server process
register.registerMetric(httpRequestDurationMicroseconds);
register.registerMetric(httpRequestErrorsTotal);
register.registerMetric(httpRequestsInProgress);
register.registerMetric(uploadedFileSizeHistogram);


// Define middleware to handle form submitting
app.use(express.urlencoded({extended:true}));
app.use(upload.array("files"));

// A simple Middleware to estimate HTTP duration
app.use((req, res, next) => {
    httpRequestsInProgress.inc();
    const end = httpRequestDurationMicroseconds.startTimer();

    res.on('finish', () => {
        const route = req.route ? req.route.path : req.originalUrl || req.url;
        end({ route: route, code: res.statusCode, method: req.method });
        httpRequestsInProgress.dec();
        if (res.statusCode >= 400) {
            httpRequestErrorsTotal.inc({method: req.method, route: route, code: res.statusCode});
        }
    })
    next();
})


const PORT = 5000;

// Define a metrics API for Prometheus scraping
app.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    } catch (ex) {
        res.status(500).end(ex);
    }
})

app.post('/upload', async (req, res) => {
    try {
        console.log('--- DEBUG ---');
        console.log('req.files:', req.files);
        console.log('req.body:', req.body);
        console.log('--- END DEBUG ---');
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({message: "No files were uploaded"})
        }

        console.log(`Received ${req.files.length} files.`);

        const processedFiles = [];
        const errors = [];

        for (const file of req.files) {
            uploadedFileSizeHistogram.observe(file.size); 
            const filename = file.filename;

            try {
                const messagePayload = {
                    filename: filename
                };

                await sending_msg(messagePayload, producer); 
                processedFiles.push(filename);

            } catch (error) {
                console.error(`Error processing file ${filename} or sending to Kafka:`, error); 
                errors.push({ filename: filename, error: error.message });
            }
        }

        if (errors.length > 0) {
            res.status(500).json({
                message: 'Some files could not be processed.',
                processed: processedFiles,
                failed: errors
            });
        } else {
            res.status(202).json({
                message: `${processedFiles.length} file(s) received and queued for processing.`,
                filenames: processedFiles 
            });
        }

    } catch (err) {
        console.error('Error in /upload handler:', err);
        res.status(500).send(err.message || 'An unexpected error occurred during upload.');
    }
});

const run = async() => {
    await producer.connect();
    console.log('Kafka Producer connected');

    app.listen(PORT, () => {
        console.log(`Server is listening at ${PORT} port`);
        console.log(`Metrics available at http://localhost:${PORT}/metrics`);
    })

    const errorTypes = ['unhandledRejection', 'uncaughtException'];
    const signalTraps = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

    errorTypes.forEach(type => {
        process.on(type, async e => {
            try {
                console.log(`process.on ${type}`);
                console.error(e);
                await producer.disconnect();
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
                await producer.disconnect(); 
            } finally {
                process.kill(process.pid, type);
            }
        });
    });
}

run().catch(e => console.error('[APP] Error starting application', e));



