const express = require('express');
const vehicleRouter = express.Router();
const { celebrate, Joi } = require('celebrate');
const VehicleController = require('../controllers/vehicle-controller');
const audit = require('../middleware/audit');

const API = {
    SCAN_VIN: '/scan-vin',
    VEHICLE_SPECIFICATIONS: '/specifications/:vin',
    VEHICLE_SELECTIONS: '/selections'
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

// Add the new routes
vehicleRouter.get(API.VEHICLE_SPECIFICATIONS, VehicleController.getVehicleSpecifications);
vehicleRouter.get(API.VEHICLE_SELECTIONS, VehicleController.getVehicleSelections);

module.exports = vehicleRouter;
