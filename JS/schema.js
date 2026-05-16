import { mysqlTable, serial, varchar, timestamp, int, text, boolean, index, uniqueIndex, bigint, foreignKey, tinyint, json } from 'drizzle-orm/mysql-core';

export const users = mysqlTable('users', {
    id: serial().primaryKey(),
    user_name: varchar('user_name', { length: 50 }).notNull(),
    email: varchar('email', { length: 100 }).notNull(),
    password: varchar('password', { length: 255 }).notNull(),
    is_admin: boolean().default(false).notNull(),
    created_at: timestamp().notNull(),
}, (table) => [
    uniqueIndex('email_idx').on(table.email),
]);

export const whitelist = mysqlTable('whitelist', {
    id: serial().primaryKey(),
    email: varchar('email', { length: 100 }).notNull(),
    created_at: timestamp().notNull(),
}, (table) => [
    uniqueIndex('email_idx').on(table.email)
]);

export const games = mysqlTable('games', {
    id: serial().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    owner_id: int().notNull(),
    category: varchar('category', { length: 50 }).notNull(),
    description: text(),
    logo_url: varchar('logo_url', { length: 255 }),
    cover_image_url: varchar('cover_image_url', { length: 255 }),
    cover_video_url: varchar('cover_video_url', { length: 255 }),
    domain: varchar('domain', { length: 255 }).notNull(),
    featured_game: bigint('featured_game', { unsigned: true, mode: 'number' }),
    paused: tinyint().default(0).notNull(),
    feature_expires_at: timestamp(),
    created_at: timestamp().notNull(),
}, (table) => [
    index('owner_id_idx').on(table.owner_id),
    index('category_idx').on(table.category),
    uniqueIndex('domain_idx').on(table.domain),
    index('name_idx').on(table.name),
    index('created_at_idx').on(table.created_at),
    foreignKey({
        columns: [table.featured_game],
        foreignColumns: [table.id],
        name: 'games_featured_game_fk'
    }).onDelete('set null')
]);

export const statistics = mysqlTable('statistics', {
    id: serial().primaryKey(),
    game_id: bigint('game_id', { unsigned: true }).references(() => games.id, { onDelete: 'cascade' }).notNull(),
    date: timestamp().notNull(),
    clicks: int().default(0).notNull(),
    referrals: int().default(0).notNull(),
}, (table) => [
    index('game_id_idx').on(table.game_id),
    index('date_idx').on(table.date),
    uniqueIndex('game_id_date_idx').on(table.game_id, table.date),
]);

export const events = mysqlTable('events', {
    id: serial().primaryKey(),
    game_id: bigint('game_id', { unsigned: true }).references(() => games.id, { onDelete: 'cascade' }).notNull(),
    type: varchar('type', { length: 50 }).notNull(),
    format: varchar('format', { length: 50 }),
    metadata: json(),
    created_at: timestamp().notNull(),
}, (table) => [
    index('game_id_idx').on(table.game_id),
    index('type_idx').on(table.type),
    index('created_at_idx').on(table.created_at),
    index('game_id_type_format_idx').on(table.game_id, table.type, table.format),
]);

