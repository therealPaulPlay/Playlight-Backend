// Using Cloudflare Turnstile
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const validateCaptcha = async (req, res, next) => {
    const turnstileToken = req.headers['cf-turnstile-response'];

    if (!turnstileToken) {
        return res.status(400).json({ error: "Turnstile token missing." });
    }

    try {
        const verificationUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
        const idempotencyKey = uuidv4();

        const validationResponse = await axios.post(verificationUrl, {
            secret: process.env.CAPTCHA_SECRET_KEY,
            response: turnstileToken,
            remoteip: req.clientIp || req.ip,
            idempotency_key: idempotencyKey
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const { success, error_codes } = validationResponse.data;
        if (!success) {
            return res.status(403).json({ error: 'Captcha validation failed.', error_codes });
        }

        // Continue with other functions
        next();
    } catch (err) {
        console.error("Error during Turnstile Captcha validation: ", err);
        return res.status(500).json({ error: 'Error validating Captcha (Turnstile) token.' });
    }
};

module.exports = validateCaptcha;