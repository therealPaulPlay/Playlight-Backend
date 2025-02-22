const express = require('express');
const bodyParser = require('body-parser');
const requestIp = require('request-ip');
const cors = require('cors');
const xss = require('xss-clean');
require('dotenv').config(); // Load environment variables

// Router Imports
const accountRouter = require("./JS/accountRouter.js");

// Function imports
const { connectDB } = require("./JS/connectDB.js");

const app = express();

// CORS configuration ------------------------------------------------------------
app.use(cors({
    origin: (origin, callback) => {
        const corsOrigins = process.env.CORS_ORIGIN.split(',').map(o =>
            /^\/.*\/$/.test(o) ? new RegExp(o.slice(1, -1)) : o
        );

        if (!origin || corsOrigins.some(pattern => typeof pattern === 'string' ? pattern === origin : pattern.test(origin))) {
            callback(null, true); // Allow requests without an origin (e.g., webhooks), otherwise check if it is matching
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
}));

// Middleware
app.use((req, res, next) => {
    if (req.originalUrl === '/subscription/webhook') {
        next(); // Skip body-parser for Stripe Webhook
    } else {
        bodyParser.json()(req, res, next); // Use body-parser for all other routes
    }
});
app.use(requestIp.mw());
app.use(xss());

// Database Connection
connectDB();

// Routers
app.use("/account", accountRouter)

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ message: 'Server is healthy.' });
});

// Start the server ----------------------------------------------------------------------------------------------------------------------------------
app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
});