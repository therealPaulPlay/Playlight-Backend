import express from 'express';
import requestIp from 'request-ip';
import cors from 'cors';
import { createRouteHandler } from "uploadthing/express";
import 'dotenv/config';

// Router Imports
import accountRouter from "./JS/accountRouter.js";
import adminRouter from "./JS/adminRouter.js";
import gameRouter from "./JS/gameRouter.js";
import platformRouter from "./JS/platformRouter.js";
import contactRouter from "./JS/contactRouter.js";
import { uploadRouter, utapiRouter } from "./JS/uploadRouter.js";

// Function imports
import { connectDB } from "./JS/connectDB.js";

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

// Start the server
app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
});