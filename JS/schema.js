// schema.js
const { mysqlTable, serial, varchar, timestamp, int, text, boolean, float, index, uniqueIndex, bigint, json } = require('drizzle-orm/mysql-core');

const users = mysqlTable('users', {
    id: serial().primaryKey(),
    user_name: varchar('user_name', { length: 50 }).notNull(),
    email: varchar('email', { length: 100 }).notNull(),
    password: varchar('password', { length: 255 }).notNull(),
    is_admin: boolean().default(false).notNull(),
    created_at: timestamp().notNull(),
}, (table) => [
    uniqueIndex('email_idx').on(table.email),
]);

const whitelist = mysqlTable('whitelist', {
    id: serial().primaryKey(),
    email: varchar('email', { length: 100 }).notNull(),
    created_at: timestamp().notNull(),
}, (table) => [
    uniqueIndex('email_idx').on(table.email)
]);

const games = mysqlTable('games', {
    id: serial().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    owner_id: int().notNull(),
    category: varchar('category', { length: 50 }).notNull(),
    description: text(),
    logo_url: varchar('logo_url', { length: 255 }),
    cover_image_url: varchar('cover_image_url', { length: 255 }),
    cover_video_url: varchar('cover_video_url', { length: 255 }),
    domain: varchar('domain', { length: 255 }).notNull(),
    boost_factor: float().default(1.0).notNull(),
    likes: int().default(0).notNull(),
    remote_config: json(),
    created_at: timestamp().notNull(),
}, (table) => [
    index('owner_id_idx').on(table.owner_id),
    index('category_idx').on(table.category),
    uniqueIndex('domain_idx').on(table.domain),
    index('name_idx').on(table.name),
    index('created_at_idx').on(table.created_at)
]);

const statistics = mysqlTable('statistics', {
    id: serial().primaryKey(),
    game_id: bigint('game_id', { unsigned: true }).references(() => games.id, { onDelete: 'cascade' }).notNull(),
    date: timestamp().notNull(),
    clicks: int().default(0).notNull(),
    playlight_opens: int().default(0).notNull(),
    referrals: int().default(0).notNull(),
}, (table) => [
    index('game_id_idx').on(table.game_id),
    index('date_idx').on(table.date),
    index('game_id_date_idx').on(table.game_id, table.date),
]);

const likes = mysqlTable('likes', {
    id: serial().primaryKey(),
    game_id: bigint('game_id', { unsigned: true }).references(() => games.id, { onDelete: 'cascade' }).notNull(),
    date: timestamp().notNull(),
    ip: varchar('ip', { length: 255 }),
}, (table) => [
    index('game_id_idx').on(table.game_id),
    uniqueIndex('game_id_ip_idx').on(table.game_id, table.ip),
]);

module.exports = { users, whitelist, games, statistics, likes };