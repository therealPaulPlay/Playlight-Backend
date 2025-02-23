const { createUploadthing } = require("uploadthing/express");
const sharp = require("sharp");
const ffprobe = require('ffprobe');
const ffprobeStatic = require('ffprobe-static');
import { authenticateTokenWithId } from "./authUtils";
import { heavyLimiter } from "./rateLimiting";

const f = createUploadthing();

// Validation helpers
async function validateImage(file, width, height) {
    try {
        const buffer = await file.arrayBuffer();
        const metadata = await sharp(buffer).metadata();

        if (metadata.format !== 'jpeg' && metadata.format !== 'jpg') {
            throw new Error('Image must be in JPEG format.');
        }

        if (metadata.width !== width || metadata.height !== height) {
            throw new Error(`Image dimensions must be ${width}x${height} pixels.`);
        }

        return true;
    } catch (error) {
        throw new Error(`Image validation failed: ${error.message}`);
    }
}

async function validateVideo(file) {
    try {
        const buffer = await file.arrayBuffer();
        const info = await ffprobe(buffer, { path: ffprobeStatic.path });

        const videoStream = info.streams.find(stream => stream.codec_type === 'video');
        if (!videoStream) throw new Error('No video stream found.');

        // Check if it's MP4
        if (info.format.format_name !== 'mp4') {
            throw new Error('Video must be in MP4 format.');
        }

        // Check 2:1 aspect ratio
        const aspectRatio = videoStream.width / videoStream.height;
        if (Math.abs(aspectRatio - 2) > 0.1) { // Allow small deviation
            throw new Error('Video must have 2:1 aspect ratio.');
        }

        return true;
    } catch (error) {
        throw new Error(`Video validation failed: ${error.message}`);
    }
}

const uploadRouter = {
    logoUploader: f({
        image: { maxFileSize: "100KB", maxFileCount: 1 }
    })
        .middleware(async ({ req, res, file }) => {
            await heavyLimiter();
            await authenticateTokenWithId(req, res);
            await validateImage(file, 500, 500);
        })
        .onUploadComplete((data) => {
            console.log("Logo upload completed.", data);
        }),

    coverImageUploader: f({
        image: { maxFileSize: "250KB", maxFileCount: 1 }
    })
        .middleware(async ({ req, res, file }) => {
            await heavyLimiter();
            await authenticateTokenWithId(req, res);
            await validateImage(file, 800, 1200);
        })
        .onUploadComplete((data) => {
            console.log("Cover image upload completed.", data);
        }),

    coverVideoUploader: f({
        video: { maxFileSize: "3MB", maxFileCount: 1 }
    })
        .middleware(async ({ req, res, file }) => {
            await heavyLimiter();
            await authenticateTokenWithId(req, res);
            await validateVideo(file);
        })
        .onUploadComplete((data) => {
            console.log("Cover video upload completed.", data);
        }),
};

module.exports = { uploadRouter };