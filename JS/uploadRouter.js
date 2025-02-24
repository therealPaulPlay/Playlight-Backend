const { createUploadthing, UploadThingError } = require("uploadthing/express");
const jwt = require("jsonwebtoken");
const sharp = require("sharp");
const { heavyLimiter } = require("./rateLimiting.js");

const f = createUploadthing();

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
    logoUploader: f(["image/jpeg"], { image: { maxFileSize: "100KB", maxFileCount: 1 } })
        .middleware(async ({ req, files, res }) => {
            await applyLimiter(req, res);
            const userId = await verifyAuth(req);
            return { userId };
        })
        .onUploadComplete((data) => {
            return { uploadedBy: data.metadata.userId };
        }),

    // Cover image uploader: expects a JPEG/PNG image (max 250KB) with dimensions 800x1200.
    coverImageUploader: f(["image/jpeg"], { image: { maxFileSize: "250KB", maxFileCount: 1 } })
        .middleware(async ({ req, files, res }) => {
            await applyLimiter(req, res);
            const userId = await verifyAuth(req);
            return { userId };
        })
        .onUploadComplete((data) => {
            return { uploadedBy: data.metadata.userId };
        }),

    // Cover video uploader: expects a video file (max 3MB).
    coverVideoUploader: f({ video: { maxFileSize: "3MB", maxFileCount: 1 } })
        .middleware(async ({ req, res }) => {
            await applyLimiter(req, res);
            const userId = await verifyAuth(req);
            return { userId };
        })
        .onUploadComplete((data) => {
            return { uploadedBy: data.metadata.userId };
        }),
};

module.exports = { uploadRouter };