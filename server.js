const express = require('express');
const requestIp = require('request-ip');
const cors = require('cors');
const xss = require('xss-clean');
const { createRouteHandler } = require("uploadthing/express");
require('dotenv').config(); // Load environment variables

// Router Imports
const accountRouter = require("./JS/accountRouter.js");
const adminRouter = require("./JS/adminRouter.js");
const gameRouter = require("./JS/gameRouter.js");
const platformRouter = require("./JS/platformRouter.js");
const contactRouter = require("./JS/contactRouter.js");
const { uploadRouter, utapiRouter } = require("./JS/uploadRouter.js");

// Function imports
const { connectDB } = require("./JS/connectDB.js");

const app = express();

// Regular CORS config
const defaultCors = cors({
    origin: (origin, callback) => {
        // Bypass cors for all localhost origins
        if (!origin || origin.includes('localhost')) {
            callback(null, origin || 'http://localhost');
            return;
        }

        // Other routes use the configured CORS origins
        const corsOrigins = process.env.CORS_ORIGIN.split(',').map(o =>
            /^\/.*\/$/.test(o) ? new RegExp(o.slice(1, -1)) : o
        );

        if (corsOrigins.some(pattern =>
            typeof pattern === 'string' ? pattern === origin : pattern.test(origin)
        )) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
});

// Open CORS configuration for platform routes
const platformCors = cors({
    origin: '*'
});

// Middleware
app.use(express.json()); // Parse the body as json for all routes
app.use(requestIp.mw());
app.use(xss());

// Database Connection
connectDB();

// Apply default CORS to most routes
app.use("/account", defaultCors, accountRouter);
app.use("/admin", defaultCors, adminRouter);
app.use("/game", defaultCors, gameRouter);
app.use("/contact", defaultCors, contactRouter);
app.use("/uploads/utapi", defaultCors, utapiRouter);
app.use(
    "/uploads/uploadthing",
    defaultCors,
    createRouteHandler({
        router: uploadRouter,
    }),
);

// Apply open CORS only to platform routes
app.use("/platform", platformCors, platformRouter);

// Health check
app.use("/health", defaultCors, (req, res) => {
    res.status(200).json({ message: 'Server is healthy.' });
});

// Start the server ----------------------------------------------------------------------------------------------------------------------------------
app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
});