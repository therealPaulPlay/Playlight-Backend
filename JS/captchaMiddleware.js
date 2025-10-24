import axios from 'axios';
import { randomUUID } from 'crypto';

// Validate captcha with Cloudflare Turnstile
export default async function validateCaptcha(req, res, next) {
    const turnstileToken = req.headers['cf-turnstile-response'];
    if (!turnstileToken) return res.status(400).json({ error: "Turnstile token missing." });

    try {
        const verificationUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
        const validationResponse = await axios.post(verificationUrl, {
            secret: process.env.CAPTCHA_SECRET_KEY,
            response: turnstileToken,
            remoteip: req.clientIp || req.ip,
            idempotency_key: randomUUID()
        }, {
            headers: { 'Content-Type': 'application/json' }
        });

        const { success, error_codes } = validationResponse.data;
        if (!success) return res.status(403).json({ error: 'Captcha validation failed.', error_codes });

        next(); // Continue with other middleware or the endpoint
    } catch (err) {
        console.error("Error during Turnstile Captcha validation: ", err);
        return res.status(500).json({ error: 'Error validating Captcha (Turnstile) token.' });
    }
}