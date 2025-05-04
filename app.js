import express from "express";
import client from 'prom-client';

// import {process} from "./src/utils/serve.js"
import { kafka, sending_msg } from "./src/config/kafka.js"
import { upload } from "./src/config/multer.js";
import { 
    httpRequestDurationMicroseconds, 
    httpRequestErrorsTotal, 
    httpRequestsInProgress,  
    uploadedFileSizeHistogram,    
} from "./src/middlewares/measurement.js";

const app = express();
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

        // Sử dụng for...of để lặp qua các đối tượng file trong mảng req.files
        for (const file of req.files) {
            const filePath = file.path; // Lấy đường dẫn chính xác từ đối tượng file

            try {
                const messagePayload = {
                    filePath: filePath
                };

                await sending_msg(messagePayload, producer); // Đợi gửi xong hoặc xử lý bất đồng bộ nếu cần
                processedFiles.push(filePath);

            } catch (error) {
                console.error(`Error processing file ${filePath} or sending to Kafka:`, error);
                errors.push({ filePath: filePath, error: error.message });
                // Không gửi phản hồi lỗi ở đây
            }
        }

        // Gửi phản hồi MỘT LẦN sau khi xử lý tất cả các tệp
        if (errors.length > 0) {
            // Nếu có lỗi, gửi phản hồi lỗi tổng hợp
            res.status(500).json({
                message: 'Some files could not be processed.',
                processed: processedFiles,
                failed: errors
            });
        } else {
            // Nếu không có lỗi, gửi phản hồi thành công
            res.status(202).json({
                message: `${processedFiles.length} file(s) received and queued for processing.`,
                filePaths: processedFiles
            });
        }

    } catch (err) {
        // Lỗi chung (ví dụ: lỗi từ middleware Multer trước khi vào handler)
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
                await producer.disconnect(); // Ngắt kết nối producer
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
                await producer.disconnect(); // Ngắt kết nối producer
            } finally {
                process.kill(process.pid, type);
            }
        });
    });
}

run().catch(e => console.error('[APP] Error starting application', e));



