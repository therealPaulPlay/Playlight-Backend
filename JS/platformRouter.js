// platformRouter.js
const express = require('express');
const platformRouter = express.Router();
const { heavyLimiter, standardLimiter, openLimiter } = require("./rateLimiting.js");
const { getDB } = require("./connectDB.js");
const { games, statistics } = require('./schema.js');
const { eq, and, gte, desc, sql, ne, lt, inArray } = require('drizzle-orm');

// Get game suggestions with pagination and category filtering
platformRouter.get('/suggestions/:category?', standardLimiter, async (req, res) => {
    const db = getDB();
    const { category } = req.params;
    const { page = 1, without } = req.query;
    const pageSize = 10;
    const pageNum = parseInt(page);
    const offset = (pageNum - 1) * pageSize;

    try {
        // Calculate novelty score SQL
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const scoreCalculation = sql`
            ((SELECT COALESCE(SUM(clicks), 0) FROM ${statistics} WHERE game_id = ${games.id}) * 2 +
             (SELECT COALESCE(SUM(referrals), 0) FROM ${statistics} WHERE game_id = ${games.id}) +
             (SELECT COALESCE(SUM(playlight_opens), 0) FROM ${statistics} WHERE game_id = ${games.id}) * 0.1 +
             CASE WHEN ${games.created_at} > ${thirtyDaysAgo} THEN (30 - DATEDIFF(CURRENT_TIMESTAMP, ${games.created_at})) * 75 ELSE 0 END)
            * ${games.boost_factor}`;

        // Build query
        let query = db
            .select({
                id: games.id,
                name: games.name,
                description: games.description,
                logo_url: games.logo_url,
                cover_image_url: games.cover_image_url,
                cover_video_url: games.cover_video_url,
                domain: games.domain,
                created_at: games.created_at,
                category: games.category,
                ranking_score: scoreCalculation.as('ranking_score')
            })
            .from(games);

        // Apply filters
        if (category && without) {
            query = query.where(and(
                eq(games.category, category),
                ne(games.domain, without)
            ));
        } else if (category) {
            query = query.where(eq(games.category, category));
        } else if (without) {
            query = query.where(ne(games.domain, without));
        }

        // Execute query
        const resultGames = await query
            .orderBy(desc(sql`ranking_score`))
            .limit(pageSize)
            .offset(offset);

        res.json({ games: resultGames });
    } catch (error) {
        console.error('Error fetching game suggestions:', error);
        res.status(500).json({ error: 'Failed to fetch game suggestions.' });
    }
});

// Get game details by domain
platformRouter.get('/game-by-domain/:domain', standardLimiter, async (req, res) => {
    const db = getDB();
    const { domain } = req.params;

    try {
        const gameDetails = await db
            .select({
                id: games.id,
                name: games.name,
                category: games.category,
                description: games.description,
                logo_url: games.logo_url
            })
            .from(games)
            .where(eq(games.domain, domain))
            .limit(1);

        if (gameDetails.length === 0) {
            return res.status(404).json({ error: 'Could not find game for this domain.' });
        }

        res.json(gameDetails[0]);
    } catch (error) {
        console.error('Error fetching game by domain:', error);
        res.status(500).json({ error: 'Failed to fetch game details.' });
    }
});

// Get available categories with caching
let categoriesCache = {
    data: null,
    lastFetched: 0
};

platformRouter.get('/categories', standardLimiter, async (req, res) => {
    const db = getDB();
    try {
        const currentTime = Date.now();

        // Check if cache is valid
        if (categoriesCache.data && (currentTime - categoriesCache.lastFetched) < 10000) { // 10s
            return res.json(categoriesCache.data);
        }

        // Cache expired or doesn't exist, fetch fresh data
        const categories = await db
            .select({ category: games.category })
            .from(games)
            .groupBy(games.category);

        // Update cache
        categoriesCache.data = categories.map(c => c.category);
        categoriesCache.lastFetched = currentTime;

        res.json(categoriesCache.data);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories.' });
    }
});

// Record Playlight open event
platformRouter.post('/event/open', openLimiter, async (req, res) => {
    const db = getDB();
    const { domain } = req.body;

    if (!domain) {
        return res.status(400).json({ error: 'Domain is required.' });
    }

    try {
        // Find the game by domain
        const game = await db
            .select({ id: games.id })
            .from(games)
            .where(eq(games.domain, domain))
            .limit(1);

        if (game.length === 0) {
            return res.status(404).json({ error: 'Could not find game for this domain.' });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Update or create statistics for today
        const existingStats = await db
            .select()
            .from(statistics)
            .where(
                and(
                    eq(statistics.game_id, game[0].id),
                    eq(statistics.date, today)
                )
            )
            .limit(1);

        if (existingStats.length > 0) {
            await db
                .update(statistics)
                .set({
                    playlight_opens: existingStats[0].playlight_opens + 1
                })
                .where(eq(statistics.id, existingStats[0].id));
        } else {
            await db
                .insert(statistics)
                .values({
                    game_id: game[0].id,
                    date: today,
                    playlight_opens: 1,
                    clicks: 0,
                    referrals: 0
                });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error recording open event:', error);
        res.status(500).json({ error: 'Failed to record open event.' });
    }
});

// Record game click event
platformRouter.post('/event/click', heavyLimiter, async (req, res) => {
    const db = getDB();
    const { gameId, sourceDomain } = req.body;

    if (!gameId || !sourceDomain) {
        return res.status(400).json({ error: 'Game ID and source domain are required.' });
    }

    try {
        // Verify both games exist
        const sourceGame = await db
            .select({ id: games.id })
            .from(games)
            .where(eq(games.domain, sourceDomain))
            .limit(1);

        const targetGame = await db
            .select({ id: games.id })
            .from(games)
            .where(eq(games.id, gameId))
            .limit(1);

        if (sourceGame.length === 0 || targetGame.length === 0) {
            return res.status(404).json({ error: 'Invalid game reference.' });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Update or create statistics for today for the clicked game (target)
        const existingTargetStats = await db
            .select()
            .from(statistics)
            .where(
                and(
                    eq(statistics.game_id, gameId),
                    eq(statistics.date, today)
                )
            )
            .limit(1);

        if (existingTargetStats.length > 0) {
            await db
                .update(statistics)
                .set({
                    clicks: existingTargetStats[0].clicks + 1
                })
                .where(eq(statistics.id, existingTargetStats[0].id));
        } else {
            await db
                .insert(statistics)
                .values({
                    game_id: gameId,
                    date: today,
                    clicks: 1,
                    playlight_opens: 0,
                    referrals: 0
                });
        }

        // Update or create statistics for the source game (tracking referrals)
        const existingSourceStats = await db
            .select()
            .from(statistics)
            .where(
                and(
                    eq(statistics.game_id, sourceGame[0].id),
                    eq(statistics.date, today)
                )
            )
            .limit(1);

        if (existingSourceStats.length > 0) {
            await db
                .update(statistics)
                .set({
                    referrals: existingSourceStats[0].referrals + 1
                })
                .where(eq(statistics.id, existingSourceStats[0].id));
        } else {
            await db
                .insert(statistics)
                .values({
                    game_id: sourceGame[0].id,
                    date: today,
                    clicks: 0,
                    playlight_opens: 0,
                    referrals: 1
                });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error recording click event:', error);
        res.status(500).json({ error: 'Failed to record click event.' });
    }
});

// Run every hour
setInterval(async () => {
    const db = getDB();

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Delete old records
    await db
        .delete(statistics)
        .where(lt(statistics.date, sixMonthsAgo));

    console.log(`Statistics cleanup completed.`);
}, 60 * 60 * 1000); // 1 hour

module.exports = platformRouter;