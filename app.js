import express from "express";
import client from "prom-client";
import path from "path";
import { fileURLToPath } from "url";
import { upload } from "./src/config/multer.js";
import { process } from "./src/utils/serve.js";
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
const PORT = 8080;

// Serve static files (frontend HTML)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

// Prometheus metrics
const register = new client.Registry();
client.collectDefaultMetrics({ register });

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

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(upload.array("files"));
const metric_measurement = createMetricMeasurementMiddleware(httpRequestDurationMicroseconds);

// Routes
app.get("/metrics", async (req, res) => {
  try {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post("/upload", metric_measurement, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files were uploaded." });
    }

    for (const file of req.files) {
      console.log(`Processing file: ${file.originalname}`);
      uploadedFileSizeHistogram.observe(file.size);
      await process(file.buffer); // giả sử đây là xử lý OCR hoặc tương tự
      filesProcessedTotal.inc();
    }

    res.status(200).json({ message: `Successfully processed ${req.files.length} file(s).` });
  } catch (err) {
    console.error("Processing error:", err.message);
    res.status(500).json({ message: "Error processing file(s).", error: err.message });
  }
});

  
// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📈 Metrics at http://localhost:${PORT}/metrics`);
});
