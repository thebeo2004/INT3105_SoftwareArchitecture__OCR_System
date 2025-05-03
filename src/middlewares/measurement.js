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