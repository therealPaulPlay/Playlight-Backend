const express = require('express');
const contactRouter = express.Router();
const { heavyLimiter } = require("./rateLimiting.js");
const { sendMail } = require('./sendEmails.js');

// Form submission endpoint
contactRouter.post('/submit', heavyLimiter, async (req, res) => {
    const { email, website, message } = req.body;

    // Validate required fields
    if (!email || !website || !message) {
        return res.status(400).json({
            error: `Email, website, and message are required fields. Email: ${email}, Website: ${website}, Message: ${message}.`
        });
    }

    // Basic email format validation
    if (!email.includes('@') || !email.includes('.')) {
        return res.status(400).json({
            error: 'Please provide a valid email address.'
        });
    }

    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.NOTIFICATION_EMAIL,
            subject: `Playlight Form Submission (${website})`,
            text: `
Contact Form Submission:

From: ${email}
Website: ${website}

Message:
${message}
            `,
            html: `
                <h2>Contact details</h2>
                <p><strong>From:</strong> ${email}</p>
                <p><strong>Website:</strong> ${website}</p>
                <h3>Message:</h3>
                <p>${message.replace(/\n/g, '<br>')}</p>
            `
        };

        await sendMail(mailOptions);

        res.json({
            message: 'Form submitted successfully!'
        });

    } catch (error) {
        console.error('Error sending contact form:', error);
        res.status(500).json({
            error: 'Failed to submit form. Please try again later.'
        });
    }
});

module.exports = contactRouter;