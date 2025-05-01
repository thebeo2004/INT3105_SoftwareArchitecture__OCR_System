import express from "express";
import {process} from "./src/utils/serve.js"
import { upload } from "./src/config/multer.js";
import client from 'prom-client';

const app = express();

// -- Prometheus Metrics Setup ---
const collectDefaultMetrics = client.collectDefaultMetrics;
const Registry = client.Registry;
const register = new Registry();
collectDefaultMetrics({ register }); // Collect default Node.js metrics

// Histogram for HTTP request duration
const httpRequestDurationMicroseconds = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'code'],
    buckets: [0.1, 0.3, 0.5, 1, 3, 5, 10]
})
register.registerMetric(httpRequestDurationMicroseconds);

// Define middleware to handle form submitting
app.use(express.urlencoded({extended:true}));
app.use(upload.array("files"));

// Define middleware to mesaure request duration
const metric_measurement = (req, res, next) => {
    const end = httpRequestDurationMicroseconds.startTimer();
    res.on('finish', () => {
        end({route: req.route?.path || req.path, code: res.statusCode, method: req.method});
    });
    next();
}


const PORT = 5000;

app.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    } catch (ex) {
        res.status(500).end(ex);
    }
})

// app.get('/process', async (req, res) => {
//     try {
//         await process();
//         res.send('Successfully processing')
//     } catch (error) {
//         res.send(error.message)
//     }
// })

app.post('/upload', metric_measurement, async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({message: "No files were uploaded"})
        }
        
        console.log(`Received ${req.files.length} files.`)

        let data = [];

        for (const file of req.files) {
            await process(file.buffer)
        }

        res.status(200).json({
            message: `Successfully uploaded and processed ${req.files.length} files.`,
        })

    } catch (err) {
        res.status(500).send(err.message);
    }
})

app.listen(PORT, () => {
    console.log(`Server is listening at ${PORT} port`);
    console.log(`Metrics available at http://localhost:${PORT}/metrics`);
})