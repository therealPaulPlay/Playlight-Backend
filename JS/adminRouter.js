import express from 'express';
import { standardLimiter } from "./rateLimiting.js";
import { authenticateTokenWithId } from "./authUtils.js";
import { getDB } from "./connectDB.js";
import { whitelist, users, statistics } from './schema.js';
import { eq, sql, gte } from 'drizzle-orm';

const adminRouter = express.Router();

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
        const formattedEmail = email.trim().toLowerCase();
        // Check if email already exists in whitelist
        const existing = await db.select().from(whitelist).where(eq(whitelist.email, formattedEmail)).limit(1);
        if (existing.length > 0) return res.status(409).json({ error: 'Email already on the whitelist.' });

        // Add to whitelist
        await db.insert(whitelist).values({
            email: formattedEmail,
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

// Get total statistics across all games by month
let totalStatsCache = {
    data: null,
    lastFetched: 0
};

// Get platform / total statistics, by month
adminRouter.get('/total-statistics', standardLimiter, async (req, res) => {
    const db = getDB();
    try {
        const currentTime = Date.now();

        // Check if cache is valid (5 minute)
        if (totalStatsCache.data && (currentTime - totalStatsCache.lastFetched) < (5 * 60 * 1000)) {
            return res.json(totalStatsCache.data);
        }

        // Get date 6 months ago from today
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5); // -5 to include current month (total of 6)
        sixMonthsAgo.setDate(1); // First day of that month
        sixMonthsAgo.setHours(0, 0, 0, 0); // Start of day

        // Query to get monthly aggregated statistics
        const monthlyStats = await db
            .select({
                // Format to YYYY-MM
                yearMonth: sql`DATE_FORMAT(${statistics.date}, '%Y-%m')`,
                totalPlaylightOpens: sql`SUM(${statistics.playlight_opens})`,
                totalReferrals: sql`SUM(${statistics.referrals})`
            })
            .from(statistics)
            .where(
                gte(statistics.date, sixMonthsAgo)
            )
            .groupBy(sql`DATE_FORMAT(${statistics.date}, '%Y-%m')`)
            .orderBy(sql`DATE_FORMAT(${statistics.date}, '%Y-%m') DESC`);

        // Update cache
        totalStatsCache.data = monthlyStats;
        totalStatsCache.lastFetched = currentTime;

        res.json(totalStatsCache.data);
    } catch (error) {
        console.error('Error fetching total statistics:', error);
        res.status(500).json({ error: 'Failed to fetch total statistics.' });
    }
});

export default adminRouter;