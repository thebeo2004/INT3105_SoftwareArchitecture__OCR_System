import client from 'prom-client';


// Histogram for HTTP request duration
export const httpRequestDurationMicroseconds = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'code'],
    buckets: [0.1, 0.3, 0.5, 1, 3, 5, 10] // Adjust buckets as needed
});

// Counter for HTTP errors
export const httpRequestErrorsTotal = new client.Counter({
    name: 'http_requests_errors_total',
    help: 'Total number of HTTP requests that resulted in an error',
    labelNames: ['method', 'route', 'code'],
});

// Counter for processed files
export const filesProcessedTotal = new client.Counter({
    name: 'files_processed_total',
    help: 'Total number of files successfully processed',
});

// Gauge for requests in progress
export const httpRequestsInProgress = new client.Gauge({
    name: 'http_requests_in_progress',
    help: 'Number of HTTP requests currently in progress',
    labelNames: ['method', 'route'],
});

// --- Granular Processing Metrics ---

// OCR Processing Duration
export const ocrProcessingDurationSeconds = new client.Histogram({
    name: 'ocr_processing_duration_seconds',
    help: 'Duration of OCR processing step in seconds',
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30] // Adjust buckets as needed
});

// PDF Creation Duration
export const pdfCreationDurationSeconds = new client.Histogram({
    name: 'pdf_creation_duration_seconds',
    help: 'Duration of PDF creation step in seconds',
    buckets: [0.05, 0.1, 0.2, 0.5, 1, 2, 5] // Adjust buckets as needed
});

// Translation Duration (if applicable)
export const translationDurationSeconds = new client.Histogram({
    name: 'translation_duration_seconds',
    help: 'Duration of translation step in seconds',
    buckets: [0.1, 0.3, 0.5, 1, 2, 5, 10] // Adjust buckets as needed
});

// --- Granular Error Metrics ---

export const ocrErrorsTotal = new client.Counter({
    name: 'ocr_errors_total',
    help: 'Total number of OCR processing errors',
    labelNames: ['error_type'] // Optional: classify errors
});

export const pdfCreationErrorsTotal = new client.Counter({
    name: 'pdf_creation_errors_total',
    help: 'Total number of PDF creation errors',
    labelNames: ['error_type'] // Optional: classify errors
});

export const translationErrorsTotal = new client.Counter({
    name: 'translation_errors_total',
    help: 'Total number of translation errors',
    labelNames: ['error_type'] // Optional: classify errors
});

// --- Input Characteristics ---

export const uploadedFileSizeHistogram = new client.Histogram({
    name: 'uploaded_file_size_bytes',
    help: 'Histogram of uploaded file sizes in bytes',
    // Buckets in bytes (e.g., 10KB, 100KB, 1MB, 10MB, 100MB)
    buckets: [10*1024, 100*1024, 1024*1024, 10*1024*1024, 100*1024*1024]
});

// Optional: OCR Pages Processed
export const ocrPagesProcessedTotal = new client.Counter({
    name: 'ocr_pages_processed_total',
    help: 'Total number of pages processed by OCR'
});

// src/middlewares/measurement.js
export function createMetricMeasurementMiddleware(httpRequestDurationMicroseconds) {
    return (req, res, next) => {
        const labels = { route: req.route?.path || req.path, method: req.method };
        httpRequestsInProgress.inc(labels); // Increment gauge on request start

        const end = httpRequestDurationMicroseconds.startTimer();
        res.on('finish', () => {
            const finalLabels = { ...labels, code: res.statusCode };
            end(finalLabels);
            httpRequestsInProgress.dec(labels); // Decrement gauge on request finish

            // Increment error counter for server errors (5xx) or client errors (4xx) if desired
            if (res.statusCode >= 400) {
                httpRequestErrorsTotal.inc(finalLabels);
            }
        });
        next();
    };
}

export const cacheHitTotal = new Counter({
    name: 'worker_cache_hit_total',
    help: 'Total number of cache hits.',
})

export const cacheMissTotal = new Counter({
    name: 'worker_cache_miss_total',
    help: 'Total number of cache missess',
})