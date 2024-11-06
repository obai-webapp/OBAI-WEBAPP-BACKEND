# Obai Backend

Obai's backend powers a scalable platform for vehicle damage assessment, facilitating secure authentication, data processing, and AI integration for damage analysis. It supports user sessions, claim processing, and data storage for both mobile and web applications, ensuring efficient and reliable access.

## Project Setup and Requirements

### Prerequisites
- **Node.js** version >=12.6.0
- **MongoDB** running locally or accessible as per `.env` configuration
- Set up environment variables in `.env`

### Installation

1. Clone the repository and navigate to the project directory.
2. Run `npm install` to install all dependencies.

### Running the Application

- **Production**: `npm start` to start the server.
- **Development**: `npm run dev` to start the server with Nodemon for auto-reloading.

## Available Scripts

- `npm start` – Starts the server.
- `npm run dev` – Starts the server with Nodemon.
- `npm test` – Runs Jest test suites.
- `npm run lint` – Runs ESLint to check for code issues.
- `npm run lint:fix` – Fixes code issues detected by ESLint.
- `npm run prettier` – Formats the code using Prettier.

### Testing

This project uses **Jest** and **Supertest** for testing the API endpoints and core functionality.

1. **Test Execution**: Run `npm test`.
2. **Continuous Testing**: Run `npm run test:watch` to watch for changes and run tests automatically.
3. **Pre-commit Hook**: Husky and lint-staged automatically run ESLint and Prettier on staged files before each commit to ensure code quality.

## Folder Structure

- **src/config** – Database and environment configurations.
- **src/controllers** – Business logic for handling requests.
- **src/models** – Database models using Mongoose.
- **src/routes** – API route definitions.
- **src/utils** – Utility functions and middleware (logging, error handling, etc.).

## Key Dependencies

- **Express** – Web framework for API handling.
- **Mongoose** – ORM for MongoDB.
- **Celebrate** – Request validation.
- **Helmet** – HTTP header protection.
- **JWT** – Authentication.
- **Winston** – Logging with daily rotation.
- **Rate Limiting** – Prevents excessive requests per user.
- **XSS Clean** – Sanitizes data to prevent XSS attacks.

## Contributing

1. Clone the repository.
2. Create a new branch for your feature or bug fix.
3. Commit and push your changes.
4. Create a pull request for review.

---

