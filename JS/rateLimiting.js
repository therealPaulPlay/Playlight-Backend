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
    windowMs: 1000,
    keyGenerator: (req) => req.clientIp,
    max: 1,
    message: { error: 'You are sending too many requests.' }
});

export const openLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    keyGenerator: (req) => req.clientIp,
    max: 1,
    message: { error: 'Not more than 1 open event per 10 minutes per user is counted.' }
});

