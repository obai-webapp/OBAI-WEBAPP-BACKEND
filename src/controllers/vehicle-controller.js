const { ErrorHandler } = require('../utils/error-handler');
const { wrapAsync } = require('../utils/wrapAsync');
const { logger } = require('../utils/winston-logger');
const axios = require('axios');
const NHTSA_BASE_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles';

const scanVIN = async (req, res) => {
    const { vin } = req.body;
    
    try {
        const response = await axios.get(`${NHTSA_BASE_URL}/DecodeVinValues/${vin}?format=json`);
        
        // Log the VIN scan attempt and result
        logger.log({
            level: 'info',
            message: {
                type: 'VIN_SCAN',
                vin,
                timestamp: new Date(),
                success: true,
                results: response.data.Results[0],
                requestId: res.locals.requestId // Using existing audit system
            }
        });

        return res.status(200).json({
            data: response.data.Results[0],
            message: 'VIN scanned successfully'
        });
    } catch (error) {
        // Log the error
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

        throw new ErrorHandler(500, 'Failed to retrieve VIN data');
    }
};

const VehicleController = {
    scanVIN: wrapAsync(scanVIN)
};

module.exports = VehicleController;
