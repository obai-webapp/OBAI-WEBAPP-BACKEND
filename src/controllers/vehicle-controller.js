const { ErrorHandler } = require('../utils/error-handler');
const { wrapAsync } = require('../utils/wrapAsync');
const { logger } = require('../utils/winston-logger');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
const Queue = require('bull');

// API endpoints and configuration
const NHTSA_BASE_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles';
const BACKUP_NHTSA_URL = 'https://car-api.nhtsa.gov/api/vehicles';
const VINAUDIT_API_BASE_URL = process.env.VINAUDIT_API_BASE_URL;
const VINAUDIT_API_KEY = process.env.VINAUDIT_API_KEY;

// Check required environment variables
if (!VINAUDIT_API_BASE_URL || !VINAUDIT_API_KEY) {
    throw new Error("VINAUDIT_API_BASE_URL and VINAUDIT_API_KEY must be set in environment variables.");
}

// Cache configuration
const vinCache = new NodeCache({ stdTTL: 3600 }); // Cache for 1 hour
const vinQueue = new Queue('VIN-Processing');

// Rate limiting configuration
const vinRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});

// Main VIN scanning function
const scanVIN = async (req, res) => {
    const { vin, batch = false } = req.body;
    
    try {
        // Check cache first
        const cachedData = vinCache.get(vin);
        if (cachedData) {
            logger.log({
                level: 'info',
                message: {
                    type: 'VIN_SCAN_CACHED',
                    vin,
                    requestId: res.locals.requestId
                }
            });
            return res.status(200).json({
                data: cachedData,
                message: 'VIN data retrieved from cache'
            });
        }

        // Handle batch requests
        if (batch) {
            await vinQueue.add({ vin, requestId: res.locals.requestId });
            return res.status(202).json({
                message: 'VIN scan request queued for processing'
            });
        }

        // Try primary NHTSA endpoint
        try {
            const response = await axios.get(`${NHTSA_BASE_URL}/DecodeVinValues/${vin}?format=json`);
            vinCache.set(vin, response.data.Results[0]);
            
            logger.log({
                level: 'info',
                message: {
                    type: 'VIN_SCAN',
                    vin,
                    endpoint: 'primary',
                    timestamp: new Date(),
                    success: true,
                    results: response.data.Results[0],
                    requestId: res.locals.requestId
                }
            });

            return res.status(200).json({
                data: response.data.Results[0],
                message: 'VIN scanned successfully'
            });
        } catch (primaryError) {
            // Try backup NHTSA endpoint
            const backupResponse = await axios.get(`${BACKUP_NHTSA_URL}/DecodeVinValues/${vin}?format=json`);
            vinCache.set(vin, backupResponse.data.Results[0]);

            logger.log({
                level: 'warn',
                message: {
                    type: 'VIN_SCAN_BACKUP',
                    vin,
                    endpoint: 'backup',
                    timestamp: new Date(),
                    success: true,
                    results: backupResponse.data.Results[0],
                    requestId: res.locals.requestId,
                    primaryError: primaryError.message
                }
            });

            return res.status(200).json({
                data: backupResponse.data.Results[0],
                message: 'VIN scanned successfully using backup service'
            });
        }
    } catch (error) {
        logger.log({
            level: 'error',
            message: {
                type: 'VIN_SCAN_ERROR',
                vin,
                timestamp: new Date(),
                error: error.message,
                requestId: res.locals.requestId
            }
        });

        throw new ErrorHandler(
            error.response?.status || 500,
            error.response?.data?.message || 'Failed to retrieve VIN data'
        );
    }
};

const getVehicleSpecifications = async (req, res, next) => {
    console.log("Received request for vehicle specifications with VIN:", req.params.vin); // Log for troubleshooting

    try {
        const { vin } = req.params;
        
        // Send request to VIN Audit API
        const response = await axios.get(`${VINAUDIT_API_BASE_URL}/specifications`, {
            params: {
                key: VINAUDIT_API_KEY,
                vin: vin,
                format: 'json', // Ensure format is set to 'json'
                include: 'attributes,equipment,colors,recalls,warranties,photos' // Add all desired fields
            }
        });

        // Log the full response for debugging
        console.log("Response from VIN Audit API:", response.data);

        if (response.data.success === true) {
            return res.status(200).json({
                data: response.data.specification,
                message: 'Vehicle specifications retrieved successfully'
            });
        } else {
            throw new ErrorHandler(400, response.data.error || 'Failed to retrieve vehicle specifications');
        }
    } catch (error) {
        console.log("Error in getVehicleSpecifications:", error); // Log the error
        logger.log({
            level: 'error',
            message: {
                type: 'VEHICLE_SPECS_ERROR',
                error: error.message,
                requestId: res.locals.requestId
            }
        });
        next(error);
    }
};

// Get vehicle selections (make, model, year options)
const getVehicleSelections = async (req, res) => {
    try {
        const { year, make, model } = req.query;
        
        const response = await axios.get(`${NHTSA_BASE_URL}/GetModelsForMakeYear/make/${make}/modelyear/${year}?format=json`);

        return res.status(200).json({
            data: response.data.Results,
            message: 'Vehicle selections retrieved successfully'
        });
    } catch (error) {
        logger.log({
            level: 'error',
            message: {
                type: 'VEHICLE_SELECTIONS_ERROR',
                error: error.message,
                requestId: res.locals.requestId
            }
        });
        throw new ErrorHandler(500, 'Error retrieving vehicle selections');
    }
};

// Process queued VIN requests
vinQueue.process(async (job) => {
    const { vin, requestId } = job.data;
    try {
        const response = await axios.get(`${NHTSA_BASE_URL}/DecodeVinValues/${vin}?format=json`);
        vinCache.set(vin, response.data.Results[0]);
        logger.log({
            level: 'info',
            message: {
                type: 'VIN_SCAN_QUEUED',
                vin,
                success: true,
                results: response.data.Results,  // Added missing comma here
                requestId
            }
        });
        return response.data.Results[0];
    } catch (error) {
        logger.log({
            level: 'error',
            message: {
                type: 'VIN_SCAN_QUEUE_ERROR',
                vin,
                error: error.message,
                requestId
            }
        });
        throw error;
    }
});

const VehicleController = {
    scanVIN: wrapAsync(scanVIN),
    getVehicleSpecifications: wrapAsync(getVehicleSpecifications),
    getVehicleSelections: wrapAsync(getVehicleSelections),
    vinRateLimiter
};

module.exports = VehicleController;
