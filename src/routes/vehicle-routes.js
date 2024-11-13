const express = require('express');
const vehicleRouter = express.Router();
const { celebrate } = require('celebrate');
const VehicleController = require('../controllers/vehicle-controller');
const audit = require('../middleware/audit');

const API = {
    SCAN_VIN: '/scan-vin'
};

// VIN validation schema
const VinValidator = {
    scanVIN: {
        body: {
            vin: Joi.string().length(17).required()
        }
    }
};

vehicleRouter.post(
    API.SCAN_VIN,
    audit,
    celebrate(VinValidator.scanVIN),
    VehicleController.scanVIN
);

module.exports = vehicleRouter;
