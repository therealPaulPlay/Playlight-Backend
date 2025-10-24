import express from 'express';
import jwt from 'jsonwebtoken';
import { standardLimiter, registerLimiter, loginLimiter } from "./rateLimiting.js";
import { getEncodedPassword, isPasswordValid, createNewJwtToken, authenticateTokenWithId } from "./authUtils.js";
import { getDB } from "./connectDB.js";
import { sendMail } from './sendEmails.js';
import { users, whitelist } from './schema.js';
import { eq } from 'drizzle-orm';

const accountRouter = express.Router();

// Get user details
accountRouter.get('/user/:id', standardLimiter, authenticateTokenWithId, async (req, res) => {
    const id = req.params?.id;
    if (!id) return res.status(400).json({ error: "Id is required." });

    const db = getDB();
    const userId = parseInt(id);

    try {
        const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (userRows.length === 0) return res.status(404).json({ error: "User not found." });
        const user = userRows[0];

        res.json({ user });
    } catch (error) {
        console.error("Error getting user:", error);
        res.status(500).json({ error: "An error occurred getting the user: " + error.message });
    }
});

// Register Endpoint
accountRouter.post('/register', registerLimiter, async (req, res) => {
    const db = getDB();
    let { userName, email, password } = req.body;

    if (!userName || !email || !password) {
        return res.status(400).json({ error: 'Username, email, and password are required.' });
    }

    try {
        userName = userName.trim();
        email = email.trim().toLowerCase();

        if (userName.length < 4 || email.length < 5) {
            return res.status(400).json({ error: "Username or email are too short." });
        }

        if (userName.length > 50 || email.length > 100) {
            return res.status(400).json({ error: "Username or email are too long." });
        }

        // Check whitelist
        const whitelisted = await db.select().from(whitelist).where(eq(whitelist.email, email)).limit(1);
        if (whitelisted.length === 0) {
            return res.status(403).json({ error: 'Email not in whitelist. Registration is by invitation only.' });
        }

        // Check if email already exists
        const existingUsers = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (existingUsers.length > 0) {
            return res.status(409).json({ error: 'Email is already in use.' });
        }

        // Generate hashed password
        const hashedPassword = await getEncodedPassword(password);
        const now = new Date();

        // Insert new user
        await db.insert(users).values({
            user_name: userName,
            email,
            password: hashedPassword,
            created_at: now,
        });

        res.status(201).json({ message: 'Registration successful.' });
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({ error: 'An error occurred during registration.' });
    }
});

// Login Endpoint
accountRouter.post('/login', loginLimiter, async (req, res) => {
    const db = getDB();
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    try {
        // Find user by email
        const usersFound = await db
            .select({ id: users.id, user_name: users.user_name, password: users.password })
            .from(users)
            .where(eq(users.email, email))
            .limit(1);
        const user = usersFound[0];

        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials.' });
        }

        // Check password
        const isValidPassword = await isPasswordValid(password, user.password);
        if (!isValidPassword) {
            return res.status(400).json({ error: 'Invalid credentials.' });
        }

        // Generate JWT token
        const accessToken = createNewJwtToken({ email, id: user.id });

        res.json({
            message: 'Login successful',
            bearerToken: accessToken,
            id: user.id,
            userName: user.user_name,
        });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'An error occurred during login.' });
    }
});

// Delete Account Endpoint
accountRouter.delete('/delete', standardLimiter, async (req, res) => {
    const db = getDB();
    const { id, password } = req.body;

    if (!id || !password) {
        return res.status(400).json({ error: 'Id and password are required.' });
    }

    const userId = parseInt(id);
    try {
        // Find user by id to retrieve password hash
        const userRows = await db.select({ password: users.password })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);
        const user = userRows[0];

        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials. User not found.' });
        }

        // Check password
        const isValidPassword = await isPasswordValid(password, user.password);
        if (!isValidPassword) {
            return res.status(400).json({ error: 'Invalid credentials.' });
        }

        // Delete user account
        await db.delete(users).where(eq(users.id, userId));

        res.json({ message: 'Account deleted successfully.' });
    } catch (error) {
        console.error('Error during account deletion:', error);
        res.status(500).json({ error: 'An error occurred during account deletion.' });
    }
});

// Request Password Reset Email Endpoint
accountRouter.post('/reset-password-request', standardLimiter, async (req, res) => {
    const db = getDB();
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required.' });
    }

    try {
        // Find user by email
        const userRows = await db.select({ id: users.id })
            .from(users)
            .where(eq(users.email, email))
            .limit(1);
        const user = userRows[0];

        if (!user) {
            return res.status(404).json({ error: 'No account with that email found.' });
        }

        // Create a password reset token
        const resetToken = jwt.sign({ email, id: user.id }, process.env.JWT_RESET_SECRET, { expiresIn: '1h' });

        // Send email with the reset token
        const resetUrl = `${process.env.SITE_DOMAIN}/login?token=${resetToken}`;
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Password Reset',
            text: `Please click this link to reset your password: ${resetUrl}`,
        };

        await sendMail(mailOptions);

        res.json({ message: 'Password reset email sent.' });
    } catch (error) {
        console.error('Error during password reset request:', error);
        res.status(500).json({ error: 'An error occurred during password reset request.' });
    }
});

// Reset Password Endpoint
accountRouter.post('/reset-password', standardLimiter, async (req, res) => {
    const db = getDB();
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token and new password are required.' });
    }

    try {
        // Verify the reset token and extract user id
        const decoded = jwt.verify(token, process.env.JWT_RESET_SECRET);

        // Hash the new password
        const hashedPassword = await getEncodedPassword(newPassword);

        // Update the user's password
        await db.update(users)
            .set({ password: hashedPassword })
            .where(eq(users.id, decoded.id));

        res.json({ message: 'Password reset successfully.' });
    } catch (error) {
        console.error('Error during password reset:', error);
        res.status(500).json({ error: 'An error occurred during password reset.' });
    }
});

export default accountRouter;