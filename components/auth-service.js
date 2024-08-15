
const jwt = require('jsonwebtoken');



// Middleware to validate JWT
function authenticateJWT(req, res, next) {
    try {
        const authHeader = req.headers['authorization'];

        // Secret key for JWT verification
        const SECRET_KEY = process.env.SECRET_KEY;

        if (authHeader) {
            const token = authHeader.split(' ')[1];

            // Decode and validate the JWT token
            res.locals.decodedToken = jwt.verify(token, SECRET_KEY);

            // Validate expiry
            const expiryTimestamp = res.locals.decodedToken.exp * 1000;
            if (expiryTimestamp < Date.now()) {
                res.status(403).send('Exception: JWT token has expired. Please contact admin ')
            }
            next();
        } else {
            res.status(401).send('Exception: JWT Token is missing.')// Unauthorized
        }
    } catch (err) {
        console.log(err)
        res.status(403).send('Exception: JWT Token is not valid.');
    }
}

module.exports =  {authenticateJWT}