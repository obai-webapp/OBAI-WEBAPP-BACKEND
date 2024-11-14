const express = require('express');
const cors = require('cors');
const axios = require('axios');
const helmet = require('helmet');
const xss = require('xss-clean');
const requestIp = require('request-ip');
const compression = require('express-compression');
const endMw = require('express-end');
const fs = require('fs');
const { isCelebrateError } = require('celebrate');
const { isJsonStr } = require('./src/utils/utils');
const { createUserApiLog } = require('./src/models/log-model');
const { expressLogger, expressErrorLogger, logger } = require('./src/utils/winston-logger');
const config = require('./src/config/config');
require('./src/config/mongoose').connect(); // Connect to MongoDB
const errorHandler = require('./src/utils/error-handler');

// Import routes
const userRoutes = require('./src/routes/user-routes');
const mediaRouter = require('./src/routes/media-routes');
const adminRouter = require('./src/routes/admin');
const claimRouter = require('./src/routes/claim');
const vehicleRouter = require('./src/routes/vehicle-routes'); // Ensure vehicleRouter is imported

const app = express();
const NHTSA_BASE_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles';

// Middleware configurations
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '50mb' }));
app.use(requestIp.mw());
app.use(helmet());
app.use(xss({ whiteList: { '*': ['style'], script: [] } })); // XSS configuration
app.use(compression());
app.use(expressLogger);
app.use(endMw); // Middleware to signal when request handling is complete

// Mount routes
app.use('/' + config.server.route + '/user', userRoutes);
app.use('/' + config.server.route + '/media', mediaRouter);
app.use('/' + config.server.route + '/admin', adminRouter);
app.use('/' + config.server.route + '/claim', claimRouter);
app.use('/vehicle', vehicleRouter); // Mount vehicle routes

// Handle 404 Not Found
app.use((req, res, next) => {
    const error = new Error(errorHandler.ERROR_404);
    error.statusCode = 404;
    next(error);
});

// Error handling for all routes
app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);

    const sendErrorResponse = (status, message, desc, stack) => {
        res.status(status).json({
            result: message,
            code: status,
            desc,
            stack: process.env.NODE_ENV === 'production' ? null : stack
        });
    };

    if (isCelebrateError(error)) {
        const errorBody = error.details.get('body') || error.details.get('headers') || error.details.get('params');
        const { details: [errorDetails] } = errorBody;
        sendErrorResponse(422, 'Validation error', errorDetails.message, error.stack);
    } else if (error.name === 'MongoError' && error.code === 11000) {
        sendErrorResponse(409, 'Conflict', 'Duplicate key', error.stack);
    } else if (error.name === 'CastError' && error.kind === 'ObjectId') {
        sendErrorResponse(400, 'Bad Request', 'Invalid ID', error.stack);
    } else if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(e => e.message);
        sendErrorResponse(422, 'Validation failed', messages.join(', '), error.stack);
    } else {
        sendErrorResponse(error.statusCode || 500, 'error', error.message || 'Internal Server Error', error.stack);
    }
});

// Log errors
app.use(expressErrorLogger);

// Handle Unhandled Rejections and Exceptions
process.on('unhandledRejection', (error) => {
    logger.log({
        level: 'error',
        message: `Unhandled Rejection:, ${JSON.stringify({ error: error.message, stack: error.stack })}`
    });
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    logger.log({
        level: 'error',
        message: `Unhandled Exception:, ${JSON.stringify({ error: error.message, stack: error.stack })}`
    });
    process.exit(1);
});

module.exports = app;
