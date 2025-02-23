// adminRouter.js
const express = require('express');
const adminRouter = express.Router();
const { standardLimiter } = require("./rateLimiting.js");
const { authenticateTokenWithId } = require("./authUtils.js");
const { getDB } = require("./connectDB.js");
const { whitelist, users, games } = require('./schema');
const { eq, like, and } = require('drizzle-orm');

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
    const db = getDB();
    try {
        const user = await db.select().from(users).where(eq(users.id, req.body?.id)).limit(1);
        if (!user[0]?.is_admin) {
            return res.status(403).json({ error: 'Admin access required.' });
        }
        next();
    } catch (error) {
        console.error('Error checking admin status:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

// Add email to whitelist
adminRouter.post('/whitelist', standardLimiter, authenticateTokenWithId, isAdmin, async (req, res) => {
    const db = getDB();
    const { email } = req.body;

    if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid email is required.' });
    }

    try {
        // Check if email already exists in whitelist
        const existing = await db.select().from(whitelist).where(eq(whitelist.email, email.toLowerCase())).limit(1);
        if (existing.length > 0) {
            return res.status(409).json({ error: 'Email already in whitelist.' });
        }

        // Add to whitelist
        await db.insert(whitelist).values({
            email: email.toLowerCase(),
            created_at: new Date()
        });

        res.status(201).json({ message: 'Email added to whitelist.' });
    } catch (error) {
        console.error('Error adding to whitelist:', error);
        res.status(500).json({ error: 'Failed to add email to whitelist.' });
    }
});

// Remove email from whitelist
adminRouter.delete('/whitelist/:email', standardLimiter, authenticateTokenWithId, isAdmin, async (req, res) => {
    const db = getDB();
    const { email } = req.params;

    try {
        await db.delete(whitelist).where(eq(whitelist.email, email.toLowerCase()));
        res.json({ message: 'Email removed from whitelist.' });
    } catch (error) {
        console.error('Error removing from whitelist:', error);
        res.status(500).json({ error: 'Failed to remove email from whitelist.' });
    }
});

// Get all whitelisted emails
adminRouter.put('/all-whitelist', standardLimiter, authenticateTokenWithId, isAdmin, async (req, res) => {
    const db = getDB();
    try {
        const whitelistedEmails = await db.select().from(whitelist).orderBy(whitelist.created_at);
        res.json(whitelistedEmails);
    } catch (error) {
        console.error('Error fetching whitelist:', error);
        res.status(500).json({ error: 'Failed to fetch whitelist.' });
    }
});

module.exports = adminRouter;