const { createUploadthing, UploadThingError } = require("uploadthing/express");
const jwt = require("jsonwebtoken");
const { UTApi } = require("uploadthing/server");
const { heavyLimiter, standardLimiter } = require("./rateLimiting.js");
const express = require('express');
const { authenticateTokenWithId } = require("./authUtils.js");
const utapiRouter = express.Router();

const f = createUploadthing();

// Initialize UTApi - this must be done on the server side
const utapi = new UTApi();

// For debugging: if no token is provided, use a fallback user ID.
async function verifyAuth(req) {
    const auth = req.headers["authorization"];
    if (!auth || !auth.startsWith("Bearer ")) {
        return "debug-user";
    }
    const token = auth.slice(7);
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded || !decoded.userId) {
            throw new UploadThingError("Authentication failed");
        }
        return decoded.userId;
    } catch (err) {
        console.log("[verifyAuth] JWT error:", err);
        throw new UploadThingError("Authentication failed");
    }
}

function applyLimiter(req, res) {
    return new Promise((resolve, reject) => {
        heavyLimiter(req, res, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

const uploadRouter = {
    // Logo uploader: expects a JPEG image (max 100KB) with dimensions 500x500.
    logoUploader: f(["image/jpeg"], { image: { maxFileSize: "100KB", maxFileCount: 1, allowedFileTypes: ["image/jpeg"] } })
        .middleware(async ({ req, files, res }) => {
            await applyLimiter(req, res);
            const userId = await verifyAuth(req);
            return { userId };
        })
        .onUploadComplete((data) => {
            return { uploadedBy: data.metadata.userId };
        }),

    // Cover image uploader: expects a JPEG/PNG image (max 250KB) with dimensions 800x1200.
    coverImageUploader: f(["image/jpeg"], { image: { maxFileSize: "250KB", maxFileCount: 1, allowedFileTypes: ["image/jpeg"] } })
        .middleware(async ({ req, files, res }) => {
            await applyLimiter(req, res);
            const userId = await verifyAuth(req);
            return { userId };
        })
        .onUploadComplete((data) => {
            return { uploadedBy: data.metadata.userId };
        }),

    // Cover video uploader: expects a video file (max 3MB).
    coverVideoUploader: f({ video: { maxFileSize: "3MB", maxFileCount: 1, allowedFileTypes: ["video/mp4"] } })
        .middleware(async ({ req, res }) => {
            await applyLimiter(req, res);
            const userId = await verifyAuth(req);
            return { userId };
        })
        .onUploadComplete((data) => {
            return { uploadedBy: data.metadata.userId };
        }),
};

// Delete file endpoint
utapiRouter.delete('/delete-file', standardLimiter, authenticateTokenWithId, async (req, res) => {
    try {
        const { fileKey } = req.body;

        if (!fileKey) {
            return res.status(400).json({ error: "File key is required." });
        }

        // Delete the file using UTApi
        await utapi.deleteFiles(fileKey);

        // Return success response
        return res.json({ success: true, message: "File deleted successfully." });
    } catch (error) {
        console.error("Error deleting file:", error);
        return res.status(500).json({
            success: false,
            error: error.message || "Failed to delete file."
        });
    }
});

module.exports = { uploadRouter, utapiRouter };