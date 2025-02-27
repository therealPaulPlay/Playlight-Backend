const express = require('express');
const bodyParser = require('body-parser');
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

// CORS configuration ------------------------------------------------------------
app.use(cors({
    origin: (origin, callback) => {
        // Public platform endpoints always allow any origin
        if (origin && origin.includes('/platform/')) {
            callback(null, true);
            return;
        }

        // Other routes use the configured CORS origins
        const corsOrigins = process.env.CORS_ORIGIN.split(',').map(o =>
            /^\/.*\/$/.test(o) ? new RegExp(o.slice(1, -1)) : o
        );

        if (!origin || corsOrigins.some(pattern =>
            typeof pattern === 'string' ? pattern === origin : pattern.test(origin)
        )) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
}));

// Middleware
app.use(express.json()); // Parse the body as json for all routes
app.use(requestIp.mw());
app.use(xss());

// Database Connection
connectDB();

// Routers
app.use("/account", accountRouter);
app.use("/admin", adminRouter);
app.use("/game", gameRouter);
app.use("/contact", contactRouter);
app.use("/platform", platformRouter);
app.use("/uploads/utapi", utapiRouter);
app.use(
    "/uploads/uploadthing",
    createRouteHandler({
        router: uploadRouter,
        config: {
            token: process.env.UPLOADTHING_TOKEN
        }
    }),
);

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ message: 'Server is healthy.' });
});

// Start the server ----------------------------------------------------------------------------------------------------------------------------------
app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
});