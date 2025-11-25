import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
    windowMs: 60 * 1000,
    keyGenerator: (req) => req.clientIp, // Use correct ip and not the one of the proxy. This uses request-ip pkg
    max: 5,
    message: 'Too many login attempts from this IP, please try again later.'
});

export const registerLimiter = rateLimit({
    windowMs: 30 * 60 * 1000,
    keyGenerator: (req) => req.clientIp,
    max: 5,
    message: { error: 'Too many accounts created from this IP, please try again after 30 minutes.' }
});

export const standardLimiter = rateLimit({
    windowMs: 1000,
    keyGenerator: (req) => req.clientIp,
    max: 10,
    message: { error: 'You are sending too many requests.' }
});

export const heavyLimiter = rateLimit({
    windowMs: 5 * 1000,
    keyGenerator: (req) => req.clientIp,
    max: 3,
    message: { error: 'You are sending too many requests.' }
});

export const formLimiter = rateLimit({
    windowMs: 30 * 60 * 1000,
    keyGenerator: (req) => req.clientIp,
    max: 3,
    message: { error: 'Too many form submissions, please try again after 30 minutes.' }
});

export const openLimiter = rateLimit({
    windowMs: 30 * 1000,
    keyGenerator: (req) => req.clientIp,
    max: 3,
    message: { error: 'Too many open events, event will not be counted.' }
});

