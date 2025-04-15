// platformRouter.js
const express = require('express');
const platformRouter = express.Router();
const { heavyLimiter, standardLimiter, openLimiter } = require("./rateLimiting.js");
const { getDB } = require("./connectDB.js");
const { games, statistics, likes } = require('./schema.js');
const { eq, and, sql, ne, lt, inArray, aliasedTable, isNotNull } = require('drizzle-orm');

// Get game suggestions with pagination and category filtering
platformRouter.get('/suggestions/:category?', standardLimiter, async (req, res) => {
    try {
        const db = getDB();
        const { category } = req.params;
        const { page = 1, without } = req.query;
        const pageSize = 15;
        const offset = (parseInt(page) - 1) * pageSize;

        // Get games with filters
        let query = db.select({
            id: games.id, name: games.name, description: games.description,
            logo_url: games.logo_url, cover_image_url: games.cover_image_url,
            cover_video_url: games.cover_video_url, domain: games.domain,
            created_at: games.created_at, category: games.category,
            likes: games.likes, boost_factor: games.boost_factor
        }).from(games);

        // Apply filters
        if (category && without) query = query.where(and(eq(games.category, category), ne(games.domain, without)));
        else if (category) query = query.where(eq(games.category, category));
        else if (without) query = query.where(ne(games.domain, without));

        const resultGames = await query; // Get games from db

        // Get stats in a single query
        const gameIds = resultGames.map(g => g.id); // Array of game ids
        const statsResults = await db.select({
            game_id: statistics.game_id,
            clicks: sql`SUM(${statistics.clicks})`.as('clicks'),
            referrals: sql`SUM(${statistics.referrals})`.as('referrals'),
            opens: sql`SUM(${statistics.playlight_opens})`.as('opens')
        }).from(statistics).where(inArray(statistics.game_id, gameIds)).groupBy(statistics.game_id);

        // Create stats map
        const statsMap = Object.fromEntries(statsResults.map(s => [
            s.game_id, {
                clicks: Number(s.clicks || 0),
                referrals: Number(s.referrals || 0),
                opens: Number(s.opens || 0)
            }
        ]));

        // Calculate scores, sort and paginate
        const gamesWithScores = resultGames.map(game => {
            const stats = statsMap[game.id] || { clicks: 0, referrals: 0, opens: 0 };

            // Calculate age bonus directly (bonus for new games)
            const createdDate = new Date(game.created_at);
            const daysSinceCreation = Math.floor((Date.now() - createdDate.getTime()) / (24 * 60 * 60 * 1000));
            const ageBonus = daysSinceCreation < 30 ? (30 - daysSinceCreation) * 200 : 0;

            const clicksScore = stats.clicks * 2;
            const referralsScore = stats.referrals;
            const opensScore = Math.round(stats.opens * 0.1);
            const likesScore = Number(game.likes) * 10;
            const rankingScore = Math.round((clicksScore + referralsScore + opensScore + likesScore + ageBonus) * Number(game.boost_factor));

            return { ...game, ranking_score: rankingScore };
        }).sort((a, b) => b.ranking_score - a.ranking_score).slice(offset, offset + pageSize);

        res.json({ games: gamesWithScores, pageSize });
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
        // Create an aliased table for the featured game
        const featuredGameTable = aliasedTable(games, 'featured_game');

        const gameDetails = await db
            .select({
                id: games.id,
                name: games.name,
                category: games.category,
                description: games.description,
                logo_url: games.logo_url,
                likes: games.likes,
                featured_game: {
                    id: featuredGameTable.id,
                    name: featuredGameTable.name,
                    description: featuredGameTable.description,
                    logo_url: featuredGameTable.logo_url,
                    cover_image_url: featuredGameTable.cover_image_url,
                    cover_video_url: featuredGameTable.cover_video_url,
                    domain: featuredGameTable.domain,
                    created_at: featuredGameTable.created_at,
                    category: featuredGameTable.category,
                    likes: featuredGameTable.likes
                }
            })
            .from(games)
            .leftJoin(
                featuredGameTable,
                eq(games.featured_game, featuredGameTable.id)
            )
            .where(eq(games.domain, domain))
            .limit(1);

        if (gameDetails.length === 0) return res.status(404).json({ error: 'Could not find game for this domain.' });

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
        today.setUTCHours(0, 0, 0, 0);

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
        today.setUTCHours(0, 0, 0, 0);

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

// Handle game ratings (likes/unlikes)
platformRouter.post('/rating/:gameId/:action', standardLimiter, async (req, res) => {
    const db = getDB();
    const { gameId, action } = req.params;
    const clientIp = req.clientIp;

    if (!gameId || !clientIp || !['like', 'unlike'].includes(action)) {
        return res.status(400).json({ error: 'Valid game ID, client IP, and action (like/unlike) are required.' });
    }

    try {
        const existingLike = await db
            .select({ id: likes.id })
            .from(likes)
            .where(
                and(
                    eq(likes.game_id, gameId),
                    eq(likes.ip, clientIp)
                )
            )
            .limit(1);

        const hasLiked = existingLike.length > 0;

        if (action === 'like' && hasLiked) return res.status(409).json({ error: 'You have already liked this game.' });
        if (action === 'unlike' && !hasLiked) return res.status(400).json({ error: 'You have not liked this game yet.' });

        await db.transaction(async (tx) => {
            if (action === 'like') {
                // Add like
                await tx
                    .insert(likes)
                    .values({
                        game_id: gameId,
                        date: new Date(),
                        ip: clientIp
                    });

                await tx
                    .update(games)
                    .set({
                        likes: sql`${games.likes} + 1`
                    })
                    .where(eq(games.id, gameId));
            } else {
                // Remove like
                await tx
                    .delete(likes)
                    .where(eq(likes.id, existingLike[0].id));

                await tx
                    .update(games)
                    .set({
                        likes: sql`GREATEST(${games.likes} - 1, 0)`
                    })
                    .where(eq(games.id, gameId));
            }
        });

        res.json({
            success: true,
            message: action === 'like' ? 'Game liked successfully.' : 'Like removed successfully.'
        });
    } catch (error) {
        console.error(`Error ${action} game:`, error);
        res.status(500).json({ error: `Failed to ${action} game.` });
    }
});

// Run every hour
setInterval(async () => {
    const db = getDB();
    try {
        // Delete old statistics records
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        await db
            .delete(statistics)
            .where(lt(statistics.date, sixMonthsAgo));

        // Check for expired featured games and remove their featured status
        const currentTime = new Date();
        await db
            .update(games)
            .set({
                featured_game: null,
                feature_expires_at: null
            })
            .where(
                and(
                    isNotNull(games.feature_expires_at),
                    lt(games.feature_expires_at, currentTime)
                )
            );

        console.log("Stats and featured games cleanup completed.");
    } catch (error) {
        console.error('Error in scheduled cleanup task in platformRouter.js:', error);
    }
}, 60 * 60 * 1000); // 1 hour

module.exports = platformRouter;