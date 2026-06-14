const express = require('express');
const router = express.Router();
const msal = require('@azure/msal-node');
const crypto = require('crypto');

// MSAL configuration
const msalConfig = {
    auth: {
        clientId: process.env.MICROSOFT_CLIENT_ID || 'mock-client-id',
        authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || 'common'}`,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET || 'mock-secret'
    },
    system: {
        loggerOptions: {
            loggerCallback(loglevel, message, containsPii) {
                console.log(message);
            },
            piiLoggingEnabled: false,
            logLevel: msal.LogLevel.Verbose
        }
    }
};

const pca = new msal.ConfidentialClientApplication(msalConfig);

// Store for user sessions (in production, use Redis or similar)
const userSessions = new Map();

// Generate random state for CSRF protection
function generateState() {
    return crypto.randomBytes(32).toString('hex');
}

// Login route - redirect to Microsoft Entra ID
router.get('/login', (req, res) => {
    const state = generateState();
    const authCodeUrlParameters = {
        scopes: ['user.read', 'mail.send', 'Mail.Read'],
        redirectUri: `http://localhost:${process.env.PORT || 3000}/auth/callback`,
        state: state
    };

    pca.getAuthCodeUrl(authCodeUrlParameters).then((response) => {
        userSessions.set(state, { createdAt: Date.now() });
        res.redirect(response);
    }).catch((error) => {
        console.error(error);
        // Mock login for demo
        res.redirect('/?mock_auth=true');
    });
});

// Callback route after Microsoft login
router.get('/callback', async (req, res) => {
    const { code, state } = req.query;
    
    if (!userSessions.has(state)) {
        return res.status(401).send('Invalid state parameter');
    }
    
    const tokenRequest = {
        code: code,
        scopes: ['user.read', 'mail.send', 'Mail.Read'],
        redirectUri: `http://localhost:${process.env.PORT || 3000}/auth/callback`
    };
    
    try {
        const response = await pca.acquireTokenByCode(tokenRequest);
        
        // Store user info in session
        req.session.user = {
            accessToken: response.accessToken,
            username: response.account.username,
            isAuthenticated: true
        };
        
        userSessions.delete(state);
        res.redirect('/');
    } catch (error) {
        console.error(error);
        res.redirect('/?auth_error=true');
    }
});

// Get current user info
router.get('/me', async (req, res) => {
    if (req.session.user && req.session.user.isAuthenticated) {
        res.json({
            success: true,
            user: {
                name: req.session.user.username,
                authenticated: true
            }
        });
    } else {
        res.json({
            success: true,
            user: {
                name: 'Demo User (Mock Mode)',
                authenticated: false,
                message: 'Configure Microsoft Entra ID for full authentication'
            }
        });
    }
});

// Logout route
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

module.exports = router;