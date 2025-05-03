import express from "express";
import client from 'prom-client';

import {process} from "./src/utils/serve.js"
import { upload } from "./src/config/multer.js";
import { 
    createMetricMeasurementMiddleware, 
    httpRequestDurationMicroseconds, 
    httpRequestErrorsTotal, 
    filesProcessedTotal, 
    httpRequestsInProgress,
    ocrProcessingDurationSeconds,
    pdfCreationDurationSeconds,
    translationDurationSeconds,
    ocrErrorsTotal,
    pdfCreationErrorsTotal,
    translationErrorsTotal,
    uploadedFileSizeHistogram,
    ocrPagesProcessedTotal
} from "./src/middlewares/measurement.js";

const app = express();

// -- Prometheus Metrics Setup ---
const collectDefaultMetrics = client.collectDefaultMetrics;
const Registry = client.Registry;
const register = new Registry();
collectDefaultMetrics({ register }); // Collect default Node.js metrics

// Register all metrics
register.registerMetric(httpRequestDurationMicroseconds);
register.registerMetric(httpRequestErrorsTotal);
register.registerMetric(filesProcessedTotal);
register.registerMetric(httpRequestsInProgress);
register.registerMetric(ocrProcessingDurationSeconds);
register.registerMetric(pdfCreationDurationSeconds);
register.registerMetric(translationDurationSeconds);
register.registerMetric(ocrErrorsTotal);
register.registerMetric(pdfCreationErrorsTotal);
register.registerMetric(translationErrorsTotal);
register.registerMetric(uploadedFileSizeHistogram);
register.registerMetric(ocrPagesProcessedTotal);


// Define middleware to handle form submitting
app.use(express.urlencoded({extended:true}));
app.use(upload.array("files"));
const metric_measurement = createMetricMeasurementMiddleware(httpRequestDurationMicroseconds);

const PORT = 5000;

app.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    } catch (ex) {
        res.status(500).end(ex);
    }
})

app.post('/upload', metric_measurement, async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({message: "No files were uploaded"})
        }
        
        console.log(`Received ${req.files.length} files.`)

        let data = [];

        for (const file of req.files) {
            // Record file size
            uploadedFileSizeHistogram.observe(file.size);

            await process(file.buffer) // Pass the buffer to process
            // Increment the counter after successfully processing each file
            filesProcessedTotal.inc(); 
        }

        res.status(200).json({
            message: `Successfully uploaded and processed ${req.files.length} files.`,
        })

    } catch (err) {
        // Error handling remains the same, error counter is incremented in middleware
        res.status(500).send(err.message);
    }
})

app.listen(PORT, () => {
    console.log(`Server is listening at ${PORT} port`);
    console.log(`Metrics available at http://localhost:${PORT}/metrics`);
})