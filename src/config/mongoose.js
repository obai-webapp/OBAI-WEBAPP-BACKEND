const mongoose = require('mongoose');
const config = require('./config'); // Adjust path as needed

exports.connect = () => {
    mongoose.set('strictQuery', true);

    mongoose
        .connect(config.server.mongoURI)  // Removed deprecated options
        .then(() => console.log('Successfully connected to MongoDB Atlas'))
        .catch((error) => {
            console.error('MongoDB connection failed. Exiting now...');
            console.error(error);
            process.exit(1);
        });
};
