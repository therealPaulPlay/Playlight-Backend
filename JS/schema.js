// schema.js
const { mysqlTable, serial, varchar, timestamp, int, text, boolean, float } = require('drizzle-orm/mysql-core');

const users = mysqlTable('users', {
    id: serial('id').primaryKey(),
    user_name: varchar('user_name', { length: 50 }),
    email: varchar('email', { length: 100 }),
    password: varchar('password', { length: 255 }),
    is_admin: boolean('is_admin').default(false),
    is_verified: boolean('is_verified').default(false),
    verification_token: varchar('verification_token', { length: 255 }),
    created_at: timestamp('created_at'),
});

const whitelist = mysqlTable('whitelist', {
    id: serial('id').primaryKey(),
    email: varchar('email', { length: 100 }),
    created_at: timestamp('created_at'),
});

const games = mysqlTable('games', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }),
    owner_id: int('owner_id'),
    category: varchar('category', { length: 50 }),
    description: text('description'),
    logo_url: varchar('logo_url', { length: 255 }),
    cover_image_url: varchar('cover_image_url', { length: 255 }),
    cover_video_url: varchar('cover_video_url', { length: 255 }),
    domain: varchar('domain', { length: 255 }),
    boost_factor: float('boost_factor').default(1.0),
    created_at: timestamp('created_at'),
});

const statistics = mysqlTable('statistics', {
    id: serial('id').primaryKey(),
    game_id: int('game_id'),
    date: timestamp('date'),
    clicks: int('clicks').default(0),
    playlight_opens: int('playlight_opens').default(0),
});

module.exports = { users, whitelist, games, statistics };