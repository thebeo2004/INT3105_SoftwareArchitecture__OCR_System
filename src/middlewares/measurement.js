import client from 'prom-client';


// Histogram for HTTP request duration
export const httpRequestDurationMicroseconds = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'code'],
    buckets: [0.1, 0.3, 0.5, 1, 3, 5, 10]
})


// src/middlewares/measurement.js
export function createMetricMeasurementMiddleware(httpRequestDurationMicroseconds) {
    return (req, res, next) => {
        const end = httpRequestDurationMicroseconds.startTimer();
        res.on('finish', () => {
            end({ route: req.route?.path || req.path, code: res.statusCode, method: req.method });
        });
        next();
    };
}