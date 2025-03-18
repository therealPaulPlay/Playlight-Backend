# Playlight (Backend)
Backend and algorithm for Playlight.

## Algorithm
The algorithm may be changed in the future depending on the circumstanes, but these ranking factors are currently implemented:

- Clicks (Like with e.g. YouTube, how many people click on your game on the Discovery) **Significant**
- Referrals (How many games other people find/click on via the Discovery on _your_ site) **Significant**
- Opens (The amount of players – not the amount of times – open the Discovery on your site) **Low**
- Novelty (New games get more visibility) **Medium**
- Likes (How many likes your game gets via the game display in the Discovery) **Medium**

## Start
Start with `npm run start` or `node server.js`.

## Database
This project uses Drizzle as the ORM. Run `npm run db:setup` to generate the migration files and perform the migration.

## Framework
[Express](https://expressjs.com/) is being used as the backend framework.

## Setup

### `server.js`
This file is the main entry point. This creates a new express server, defines the routes, the global middleware and cors configuration.

### `/JS/schema.js`
Drizzle database schema.

### `/JS/accountRouter.js`
Account related routes (registration, login, password resets...).

### `/JS/adminRouter.js`
Routes that require admin permissions. This includes whitelist management.

### `/JS/authUtils.js`
Authentication functions for decoding and verifying the JWT token and hashing the password.

### `/JS/captchaMiddleware.js`
Cloudflare captcha utility.

### `/JS/connectDB.js`
Creates the MySQL connection pool and connects to it using drizzle.

### `/JS/contactRouter.js`
Manages the routes required for form submissions.

### `/JS/gameRouter.js`
These routes handle the creation of games, updating games, as well as fetching and managing them.

### `/JS/platformRouter.js`
Public routes (no CORS restrictions) related to the SDK. It handles e.g. fetching game suggestions and tracking events & stats.

### `/JS/rateLimiting.js`
Rate-limiting middleware functions using the `express-rate-limit` and `request-ip` packages.

### `/JS/schema.js`
Drizzle database schema.

### `/JS/sendEmails.js`
Function to send out emails using `nodemailer`.

### `/JS/uploadRouter.js`
File upload routes, using `uploadthing`.