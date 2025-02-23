const express = require('express');
const gameRouter = express.Router();
const { standardLimiter, heavyLimiter } = require("./rateLimiting.js");
const { authenticateTokenWithId } = require("./authUtils.js");
const { getDB } = require("./connectDB.js");
const { games, statistics, users } = require('./schema');
const { eq, and, gte, desc, sql } = require('drizzle-orm');

// Fetch games with pagination and search (id is the user id here)
gameRouter.get('/:id', standardLimiter, authenticateTokenWithId, async (req, res) => {
    const db = getDB();
    const { page = 1, search, category } = req.query;
    const pageSize = 50;
    const offset = (parseInt(page) - 1) * pageSize;

    try {
        // Check if user is admin
        const user = await db.select().from(users).where(eq(users.id, req.user.id)).limit(1);

        // Build query conditions
        let conditions = [];
        if (search) {
            conditions.push(
                or(
                    like(games.name, `%${search}%`),
                    like(games.description, `%${search}%`),
                    like(games.domain, `%${search}%`)
                )
            );
        }
        if (category) {
            conditions.push(eq(games.category, category));
        }
        if (!user[0].is_admin) {
            conditions.push(eq(games.owner_id, req.user.id)); // Non-admin users can only see their own games
        }

        // Execute query with conditions
        const gamesResult = await db
            .select({
                id: games.id,
                name: games.name,
                category: games.category,
                domain: games.domain,
                description: games.description,
                logo_url: games.logo_url,
                cover_image_url: games.cover_image_url,
                cover_video_url: games.cover_video_url,
                boost_factor: games.boost_factor,
                created_at: games.created_at,
            })
            .from(games)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .limit(pageSize)
            .offset(offset)
            .orderBy(desc(games.created_at));

        res.json({
            games: gamesResult,
        });
    } catch (error) {
        console.error('Error fetching games:', error);
        res.status(500).json({ error: 'Failed to fetch games' });
    }
});

// Create game
gameRouter.post('/', heavyLimiter, authenticateTokenWithId, async (req, res) => {
    const db = getDB();
    const { id: ownerId, name, category, description, domain, logoUrl, coverImageUrl, coverVideoUrl } = req.body;

    try {
        // Validate input
        if (!name || !category || !description || !domain) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (description.length > 500) {
            return res.status(400).json({ error: 'Description too long' });
        }

        // Check domain uniqueness
        const existingGame = await db.select().from(games).where(eq(games.domain, domain)).limit(1);
        if (existingGame.length > 0) {
            return res.status(409).json({ error: 'Domain already registered' });
        }

        // Insert game
        const result = await db.insert(games).values({
            name,
            owner_id: ownerId,
            category,
            description,
            domain,
            logo_url: logoUrl,
            cover_image_url: coverImageUrl,
            cover_video_url: coverVideoUrl,
            created_at: new Date()
        });

        res.status(201).json({ message: 'Game created successfully', id: result.insertId });
    } catch (error) {
        console.error('Error creating game:', error);
        res.status(500).json({ error: 'Failed to create game' });
    }
});

// Update game (Admin)
gameRouter.put('/:id', standardLimiter, authenticateTokenWithId, async (req, res) => {
    const db = getDB();
    const gameId = parseInt(req.params.id);
    const { id: userId, name, category, description, domain, logoUrl, coverImageUrl, coverVideoUrl } = req.body;

    try {
        // Check ownership or admin status
        const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        const game = await db.select().from(games).where(eq(games.id, gameId)).limit(1);

        if (!game[0]) {
            return res.status(404).json({ error: 'Game not found' });
        }

        if (!user[0].is_admin && game[0].owner_id !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Update game
        await db.update(games)
            .set({
                name,
                category,
                description,
                domain,
                logo_url: logoUrl,
                cover_image_url: coverImageUrl,
                cover_video_url: coverVideoUrl
            })
            .where(eq(games.id, gameId));

        res.json({ message: 'Game updated successfully' });
    } catch (error) {
        console.error('Error updating game:', error);
        res.status(500).json({ error: 'Failed to update game' });
    }
});

// Delete game
gameRouter.delete('/:id', standardLimiter, authenticateTokenWithId, async (req, res) => {
    const db = getDB();
    const gameId = parseInt(req.params.id);
    const { id: userId, password } = req.body;

    try {
        // Verify ownership or admin status
        const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        const game = await db.select().from(games).where(eq(games.id, gameId)).limit(1);

        if (!game[0]) {
            return res.status(404).json({ error: 'Game not found' });
        }

        if (!user[0].is_admin && game[0].owner_id !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Verify password
        const isValidPassword = await isPasswordValid(password, user[0].password);
        if (!isValidPassword) {
            return res.status(403).json({ error: 'Invalid password' });
        }

        // Delete game and its statistics
        await db.delete(statistics).where(eq(statistics.game_id, gameId));
        await db.delete(games).where(eq(games.id, gameId));

        res.json({ message: 'Game deleted successfully' });
    } catch (error) {
        console.error('Error deleting game:', error);
        res.status(500).json({ error: 'Failed to delete game' });
    }
});

// Get game statistics
gameRouter.put('/:id/statistics', standardLimiter, authenticateTokenWithId, async (req, res) => {
    const db = getDB();
    const gameId = parseInt(req.params.id);
    const { days, id: userId } = req.body;

    try {
        // Verify ownership or admin status
        const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        const game = await db.select().from(games).where(eq(games.id, gameId)).limit(1);

        if (!game[0]) {
            return res.status(404).json({ error: 'Game not found' });
        }

        if (!user[0].is_admin && game[0].owner_id !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days || 7));

        const stats = await db.select({
            date: statistics.date,
            playersGained: statistics.clicks,
            gamesReferred: statistics.playlight_opens
        })
            .from(statistics)
            .where(
                and(
                    eq(statistics.game_id, gameId),
                    gte(statistics.date, startDate)
                )
            )
            .orderBy(desc(statistics.date));

        res.json(stats);
    } catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

module.exports = gameRouter;