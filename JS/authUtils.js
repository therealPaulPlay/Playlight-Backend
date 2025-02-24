const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Generate password hash for the registration
async function getEncodedPassword(plainPassword) {
    const saltRounds = 10;
    try {
        const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);
        return hashedPassword;
    } catch (error) {
        console.error('Error hashing password:', error);
        throw error;
    }
}

// Check password against hash for the login
async function isPasswordValid(plainPassword, hashedPassword) {
    try {
        if (!plainPassword) throw new Error("No password provided!");
        const isValid = await bcrypt.compare(plainPassword, hashedPassword);
        return isValid;
    } catch (error) {
        console.error('Error validating password:', error);
        throw error;
    }
}

function createNewJwtToken(user) {
    let accessToken = '';

    try {
        const jwtTokenExpirationTime = Math.floor(Date.now() / 1000) + (12 * 60 * 60); // 12 hours

        accessToken = jwt.sign(
            {
                sub: user.email, // Subject (email address)
                userId: user.id // Custom claim for user ID
            },
            process.env.JWT_SECRET,
            {
                expiresIn: jwtTokenExpirationTime
            }
        );
    } catch (e) {
        accessToken = '';
        console.error('Token generation error: ', e.message);
    }

    console.info('JWT token generated successfully.');
    return accessToken;
}

function authenticateTokenWithId(req, res, next) {
    const authorizationHeader = req.headers['authorization'];

    if (authorizationHeader && authorizationHeader.startsWith('Bearer ')) {
        const token = authorizationHeader.substring('Bearer '.length);

        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) {
                return res.status(403).json({ status: 403, error: "An error occurred decoding the Authentication token." });
            }

            if (!decoded || !decoded.userId) {
                return res.status(403).json({ status: 403, error: "Access token lacks user id." });
            }

            const tokenUserId = decoded.userId;
            const requestUserId = req.body.id ? req.body.id : req.params.id; // get id from params or from body, depending on what exists !CHANGE this if you want to use /:id as a request parameter for different use cases

            // Compare token userId with the requested userId
            if (tokenUserId != requestUserId) {
                console.error("User ID from access token does not match user id. Id from Token: " + tokenUserId + ", Id from request: " + requestUserId);
                return res.status(403).json({ status: 403, error: "User ID from access token does not match requested user id." });
            }

            next?.();
        });
    } else {
        return res.status(401).json({ status: 401, error: "No authentication token in request. Try signing out and in again." });
    }
}

module.exports = { getEncodedPassword, isPasswordValid, createNewJwtToken, authenticateTokenWithId };