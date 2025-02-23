const { createUploadthing } = require("uploadthing/express");
import { authenticateTokenWithId } from "./authUtils";
import { heavyLimiter } from "./rateLimiting";

const f = createUploadthing();

const uploadRouter = {
    logoUploader: f({
        image: { maxFileSize: "100KB", maxFileCount: 1 }
    }).middleware(async ({ req, res }) => { await heavyLimiter(); await authenticateTokenWithId(req, res) }).onUploadComplete((data) => {
        console.log("Logo upload completed.", data);
    }),

    coverImageUploader: f({
        image: { maxFileSize: "250KB", maxFileCount: 1 }
    }).middleware(async ({ req, res }) => { await heavyLimiter(); await authenticateTokenWithId(req, res) }).onUploadComplete((data) => {
        console.log("Cover image upload completed.", data);
    }),

    coverVideoUploader: f({
        video: { maxFileSize: "3MB", maxFileCount: 1 }
    }).middleware(async ({ req, res }) => { await heavyLimiter(); await authenticateTokenWithId(req, res) }).onUploadComplete((data) => {
        console.log("Cover video upload completed.", data);
    }),
};

module.exports = { uploadRouter };