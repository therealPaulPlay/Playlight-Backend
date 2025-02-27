// platformRouter.js
const express = require('express');
const platformRouter = express.Router();
const { heavyLimiter, standardLimiter } = require("./rateLimiting.js");
const { getDB } = require("./connectDB.js");
const { games, statistics } = require('./schema.js');
const { eq, and, gte, desc, sql, ne } = require('drizzle-orm');

// Get game suggestions with pagination and category filtering
platformRouter.get('/suggestions/:category?', standardLimiter, async (req, res) => {
    const db = getDB();
    const { category } = req.params;
    const { page = 1 } = req.query;
    const pageSize = 10;
    const offset = (parseInt(page) - 1) * pageSize;

    try {
        // Calculate novelty score based on age (higher for newer games, decays over time)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Build query for the specified category (or all if no category specified)
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
                ranking_score: sql`
            (
              (SELECT COALESCE(SUM(clicks), 0) FROM ${statistics} WHERE game_id = ${games.id}) * 2 +
              (SELECT COALESCE(SUM(playlight_opens), 0) FROM ${statistics} WHERE game_id = ${games.id}) +
              CASE
                WHEN ${games.created_at} > ${thirtyDaysAgo}
                THEN (30 - DATEDIFF(CURRENT_TIMESTAMP, ${games.created_at})) * 0.5
                ELSE 0
              END
            ) * ${games.boost_factor}
          `.as('ranking_score')
            })
            .from(games);

        // Apply category filter only if provided
        if (category) query = query.where(eq(games.category, category));

        // Complete the query with ordering and pagination
        const categoryGames = await query
            .orderBy(desc(sql`ranking_score`))
            .limit(pageSize)
            .offset(offset);

        // Get total count for pagination of the filtered category
        let countQuery = db.select({ count: sql`COUNT(*)` }).from(games);
        if (category) countQuery = countQuery.where(eq(games.category, category));
        const [{ count }] = await countQuery;

        // If we don't have enough games in the category and a category was selected,
        // fetch additional games from other categories to fill up to pageSize
        let resultGames = categoryGames;

        if (category && categoryGames.length < pageSize) {
            // Get additional games from other categories
            const additionalGamesNeeded = pageSize - categoryGames.length;

            const otherCategoryGames = await db
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
                    ranking_score: sql`
              (
                (SELECT COALESCE(SUM(clicks), 0) FROM ${statistics} WHERE game_id = ${games.id}) * 2 +
                (SELECT COALESCE(SUM(playlight_opens), 0) FROM ${statistics} WHERE game_id = ${games.id}) +
                CASE
                  WHEN ${games.created_at} > ${thirtyDaysAgo}
                  THEN (30 - DATEDIFF(CURRENT_TIMESTAMP, ${games.created_at})) * 0.5
                  ELSE 0
                END
              ) * ${games.boost_factor}
            `.as('ranking_score')
                })
                .from(games)
                .where(ne(games.category, category))
                .orderBy(desc(sql`ranking_score`))
                .limit(additionalGamesNeeded);

            // Combine the results
            resultGames = [...categoryGames, ...otherCategoryGames];
        }

        res.json({
            games: resultGames,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(count / pageSize),
                totalGames: count
            }
        });
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
            return res.status(404).json({ error: 'Game not found for this domain.' });
        }

        res.json(gameDetails[0]);
    } catch (error) {
        console.error('Error fetching game by domain:', error);
        res.status(500).json({ error: 'Failed to fetch game details.' });
    }
});

// Get available categories
platformRouter.get('/categories', standardLimiter, async (req, res) => {
    const db = getDB();

    try {
        // Get unique categories that have at least one game
        const categories = await db
            .select({ category: games.category })
            .from(games)
            .groupBy(games.category);

        res.json(categories.map(c => c.category));
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories.' });
    }
});

// Record Playlight open event
platformRouter.post('/event/open', heavyLimiter, async (req, res) => {
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
                    clicks: 0
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

        // Update or create statistics for today for the clicked game
        const existingStats = await db
            .select()
            .from(statistics)
            .where(
                and(
                    eq(statistics.game_id, gameId),
                    eq(statistics.date, today)
                )
            )
            .limit(1);

        if (existingStats.length > 0) {
            await db
                .update(statistics)
                .set({
                    clicks: existingStats[0].clicks + 1
                })
                .where(eq(statistics.id, existingStats[0].id));
        } else {
            await db
                .insert(statistics)
                .values({
                    game_id: gameId,
                    date: today,
                    clicks: 1,
                    playlight_opens: 0
                });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error recording click event:', error);
        res.status(500).json({ error: 'Failed to record click event.' });
    }
});

module.exports = platformRouter;