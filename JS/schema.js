// schema.js
const { mysqlTable, serial, varchar, timestamp, int, text, boolean, float, index, uniqueIndex, bigint } = require('drizzle-orm/mysql-core');

const users = mysqlTable('users', {
    id: serial('id').primaryKey(),
    user_name: varchar('user_name', { length: 50 }).notNull(),
    email: varchar('email', { length: 100 }).notNull(),
    password: varchar('password', { length: 255 }).notNull(),
    is_admin: boolean('is_admin').default(false).notNull(),
    created_at: timestamp('created_at').notNull(),
}, (table) => [
    uniqueIndex('email_idx').on(table.email),
]);

const whitelist = mysqlTable('whitelist', {
    id: serial('id').primaryKey(),
    email: varchar('email', { length: 100 }).notNull(),
    created_at: timestamp('created_at').notNull(),
}, (table) => [
    uniqueIndex('email_idx').on(table.email)
]);

const games = mysqlTable('games', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    owner_id: int('owner_id').notNull(),
    category: varchar('category', { length: 50 }).notNull(),
    description: text('description'),
    logo_url: varchar('logo_url', { length: 255 }),
    cover_image_url: varchar('cover_image_url', { length: 255 }),
    cover_video_url: varchar('cover_video_url', { length: 255 }),
    domain: varchar('domain', { length: 255 }).notNull(),
    boost_factor: float('boost_factor').default(1.0).notNull(),
    created_at: timestamp('created_at').notNull(),
}, (table) => [
    index('owner_id_idx').on(table.owner_id),
    index('category_idx').on(table.category),
    uniqueIndex('domain_idx').on(table.domain),
    index('name_idx').on(table.name), // For search functionality
    index('created_at_idx').on(table.created_at) // For sorting and novelty calculations
]);

const statistics = mysqlTable('statistics', {
    id: serial('id').primaryKey(),
    game_id: bigint('game_id', { unsigned: true }).references(() => games.id, { onDelete: 'cascade' }).notNull(),
    date: timestamp('date').notNull(),
    clicks: int('clicks').default(0).notNull(),
    playlight_opens: int('playlight_opens').default(0).notNull(),
}, (table) => [
    index('game_id_idx').on(table.game_id),
    index('date_idx').on(table.date),
    index('game_id_date_idx').on(table.game_id, table.date),

]);

module.exports = { users, whitelist, games, statistics };