require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken'); 
 
const app = express();
const PORT = process.env.PORT || 3000; 

// Secret key for JWT verification
const SECRET_KEY = process.env.SECRET_KEY;
// Middleware to validate JWT
function authenticateJWT(req, res, next) {
    const authHeader = req.headers['authorization'];
    console.log(authHeader)
    
    if (authHeader) {
        const token = authHeader.split(' ')[1];

        jwt.verify(token, SECRET_KEY, (err, user) => {
            if (err) {
                console.log(err)
                return res.sendStatus(403); // Forbidden 
            }
            req.user = user;
            next();
        });
    } else {
        res.sendStatus(401); // Unauthorized
    }
}

// SSE endpoint
app.get('/stream', authenticateJWT, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendEvent = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Example: Send a message every second
    const intervalId = setInterval(() => {
        sendEvent({ message: 'Hello, this is a server-sent event!' });
    }, 1000);

    // Clean up when client closes connection
    req.on('close', () => {
        clearInterval(intervalId);
        res.end();
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

//curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c" http://localhost:3000/stream
