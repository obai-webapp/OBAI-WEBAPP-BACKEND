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

// Routes
const userRoutes = require('./src/routes/user-routes');
const mediaRouter = require('./src/routes/media-routes');
const adminRouter = require('./src/routes/admin');
const claimRouter = require('./src/routes/claim');

const app = express();
const NHTSA_BASE_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles';

// Ensure uploads folder exists
const uploadsFolder = './uploads';
if (!fs.existsSync(uploadsFolder)) {
    fs.mkdirSync(uploadsFolder);
}

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

// Custom route to ping the server
app.get('/' + config.server.route + '/pingServer', (req, res) => {
    res.status(200).send('OK');
});

// Middleware for logging API interactions in DB
app.use((req, res, next) => {
    res.once('end', () => {
        createUserApiLog(req, res);
    });
    const oldSend = res.send;
    res.send = function (data) {
        res.locals.resBody = isJsonStr(data) ? JSON.parse(data) : data;
        oldSend.apply(res, arguments);
    };
    next();
});

// Serve static files from uploads
app.use('/uploads', express.static('uploads'));

// NHTSA API Routes

// 1. Get All Vehicle Makes
app.get('/api/all-makes', async (req, res, next) => {
    try {
        const response = await axios.get(`${NHTSA_BASE_URL}/GetAllMakes?format=json`);
        res.json(response.data);
    } catch (error) {
        next(error);
    }
});

// 2. Get Models for a Specific Make
app.get('/api/vehicle-models/:make', async (req, res, next) => {
    try {
        const make = req.params.make;
        const response = await axios.get(`${NHTSA_BASE_URL}/GetModelsForMake/${make}?format=json`);
        res.json(response.data);
    } catch (error) {
        next(error);
    }
});

// 3. Decode a VIN
app.get('/api/decode-vin/:vin', async (req, res, next) => {
    try {
        const vin = req.params.vin;
        const response = await axios.get(`${NHTSA_BASE_URL}/DecodeVinValues/${vin}?format=json`);
        res.json(response.data);
    } catch (error) {
        next(error);
    }
});

// Optional NHTSA Routes
app.get('/api/vehicle-types/:make', async (req, res, next) => {
    try {
        const make = req.params.make;
        const response = await axios.get(`${NHTSA_BASE_URL}/GetVehicleTypesForMake/${make}?format=json`);
        res.json(response.data);
    } catch (error) {
        next(error);
    }
});

app.get('/api/makes-for-vehicle-type/:vehicleType', async (req, res, next) => {
    try {
        const vehicleType = req.params.vehicleType;
        const response = await axios.get(`${NHTSA_BASE_URL}/GetMakesForVehicleType/${vehicleType}?format=json`);
        res.json(response.data);
    } catch (error) {
        next(error);
    }
});

app.get('/api/equipment-plant-codes', async (req, res, next) => {
    try {
        const response = await axios.get(`${NHTSA_BASE_URL}/GetEquipmentPlantCodes?format=json`);
        res.json(response.data);
    } catch (error) {
        next(error);
    }
});

// Additional Routes
app.use('/' + config.server.route + '/user', userRoutes);
app.use('/' + config.server.route + '/media', mediaRouter);
app.use('/' + config.server.route + '/admin', adminRouter);
app.use('/' + config.server.route + '/claim', claimRouter);

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
