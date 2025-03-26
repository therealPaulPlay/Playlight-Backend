const { createUploadthing, UploadThingError } = require("uploadthing/express");
const jwt = require("jsonwebtoken");
const { UTApi } = require("uploadthing/server");
const { heavyLimiter, standardLimiter } = require("./rateLimiting.js");
const express = require('express');
const { authenticateTokenWithId } = require("./authUtils.js");
const { users, games } = require("./schema.js");
const { getDB } = require("./connectDB.js");
const { eq, like, or } = require("drizzle-orm");
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
            throw new UploadThingError("Authentication failed.");
        }
        return decoded.userId;
    } catch (err) {
        console.log("[verifyAuth] JWT error:", err);
        throw new UploadThingError("Authentication failed due to error.");
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

async function checkAdmin(id) {
    const db = getDB();
    const user = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user[0]?.is_admin) {
        throw new UploadThingError("Admin access not granted.");
    }
}

const uploadRouter = {
    // Logo uploader: expects a JPEG image (max 75KB) with dimensions 500x500.
    logoUploader: f(["image/jpeg"], { image: { maxFileSize: "75KB", maxFileCount: 1, allowedFileTypes: ["image/jpeg"] } })
        .middleware(async ({ req, res }) => {
            await applyLimiter(req, res);
            const userId = await verifyAuth(req);
            return { userId };
        })
        .onUploadComplete((data) => {
            return { uploadedBy: data.metadata.userId };
        }),

    // Cover image uploader: expects a JPEG image (max 150KB) with dimensions 800x1200.
    coverImageUploader: f(["image/jpeg"], { image: { maxFileSize: "150KB", maxFileCount: 1, allowedFileTypes: ["image/jpeg"] } })
        .middleware(async ({ req, res }) => {
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
utapiRouter.delete('/delete-file-if-unused', standardLimiter, authenticateTokenWithId, async (req, res) => {
    try {
        const { fileKey } = req.body;
        if (!fileKey) return res.status(400).json({ error: "File key is required." });

        const db = getDB();
        const usedImage = await db.select({
            logoUrl: games.logo_url,
            coverImageUrl: games.cover_image_url,
            coverVideoUrl: games.cover_video_url
        }).from(games).where(
            or(
                like(
                    games.logo_url, "%" + fileKey
                ),
                like(
                    games.cover_image_url, "%" + fileKey
                ),
                like(
                    games.cover_video_url, "%" + fileKey
                )
            ));

        if (usedImage[0]) return res.json({ used: true, message: "File is in use – aborting deletion." });

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

// File cleanup endpoint - removes unused files
utapiRouter.post('/cleanup-files', heavyLimiter, authenticateTokenWithId, async (req, res) => {
    try {
        const db = getDB();
        await checkAdmin(req.body?.id);

        // Step 1: Get all files from UploadThing
        const allFiles = await utapi.listFiles();
        if (!allFiles.files || allFiles.files.length === 0) {
            return res.json({ message: 'No files found to clean up.', deletedCount: 0 });
        }

        // Step 2: Get all games to check for file usage
        const allGames = await db.select({
            logoUrl: games.logo_url,
            coverImageUrl: games.cover_image_url,
            coverVideoUrl: games.cover_video_url
        }).from(games);

        // Step 3: Create a set of all file keys used in games
        // We need to extract the file key from the URL
        const usedKeys = new Set();
        allGames.forEach(game => {
            // Extract the file key from the end of each URL
            // URL format appears to be like: https://fo44pnkn0k.ufs.sh/f/6LboSMjaJMLA1K4Fq4vjIcBunLWxJmdtvMAG0Ql7yK5HUZCa
            const extractKeyFromUrl = (url) => {
                if (!url) return null;
                const parts = url.split('/');
                return parts[parts.length - 1]; // Get the last part after the final slash
            };

            if (game.logoUrl) {
                const key = extractKeyFromUrl(game.logoUrl);
                if (key) usedKeys.add(key);
            }
            if (game.coverImageUrl) {
                const key = extractKeyFromUrl(game.coverImageUrl);
                if (key) usedKeys.add(key);
            }
            if (game.coverVideoUrl) {
                const key = extractKeyFromUrl(game.coverVideoUrl);
                if (key) usedKeys.add(key);
            }
        });

        // Step 4: Find files that aren't being used
        const unusedFiles = allFiles.files.filter(file => !usedKeys.has(file.key));

        if (unusedFiles.length === 0) {
            return res.json({ message: 'No unused files found.', deletedCount: 0 });
        }

        // Step 5: Delete unused files
        const fileKeysToDelete = unusedFiles.map(file => file.key);

        if (fileKeysToDelete.length > 0) {
            await utapi.deleteFiles(fileKeysToDelete);
            console.log("Files deleted:", fileKeysToDelete);
        }

        // Return success response with deleted file count
        return res.json({
            success: true,
            message: `Successfully deleted ${fileKeysToDelete.length} unused files.`,
            deletedCount: fileKeysToDelete.length,
            deletedFiles: unusedFiles.map(f => ({ key: f.key, name: f.name }))
        });
    } catch (error) {
        console.error('Error cleaning up files:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to clean up files.'
        });
    }
});

module.exports = { uploadRouter, utapiRouter };