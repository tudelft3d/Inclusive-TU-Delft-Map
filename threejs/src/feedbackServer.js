// feedback-server.js
// ------------------------------------------------------------
// Express server that receives POST /api/feedback
// and correctly handles CORS for localhost development.
// ------------------------------------------------------------
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const Joi = require('joi');   // optional validation

const app = express();

// -------------------- Configuration --------------------
const PORT = process.env.PORT || 3001;

// These are the exact origins your front‑end will run from during dev.
// Add more strings if you have additional dev URLs, or replace with '*'.
const allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
];

// Path to the log file (JSON‑Lines)
const LOG_FILE = 'feedback/feedback.log';

// -------------------- Middleware --------------------
app.use(express.json());

// CORS – dynamic origin checking
app.use(
    cors({
        origin: (origin, callback) => {
            // `origin` can be undefined for tools like curl or Postman – allow them.
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin)) return callback(null, true);
            // If you ever want to allow any origin, replace the above with:
            // return callback(null, true);
            return callback(new Error('Not allowed by CORS'), false);
        },
        methods: ['POST'],               // we only need POST
        allowedHeaders: ['Content-Type'],
    })
);

// -------------------- Validation schema (optional) --------------------
const feedbackSchema = Joi.object({
    suggestion: Joi.string().trim().min(1).max(2000).required(),
    type: Joi.string().allow(null, ''),
    location: Joi.string().allow(null, ''),
    email: Joi.string().email({ tlds: { allow: false } }).required(),
    submittedAt: Joi.string().isoDate(),
});

// -------------------- Route --------------------
app.post('/api/feedback', async (req, res) => {
    // ---- Validate payload (remove if you don't need it) ----
    const { error, value } = feedbackSchema.validate(req.body, { abortEarly: false });
    if (error) {
        return res.status(400).json({ error: error.details.map(d => d.message) });
    }

    // ---- Build log entry -------------------------------------------------
    const entry = {
        ...value,
        receivedAt: new Date().toISOString(),
        ip: req.ip,
    };

    // ---- Persist ---------------------------------------------------------
    try {
        await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
        await fs.appendFile(LOG_FILE, JSON.stringify(entry) + '\n', 'utf8');
        return res.status(200).json({ ok: true });
    } catch (writeErr) {
        console.error('❌ Failed to write feedback:', writeErr);
        return res.status(500).json({ error: 'Unable to store feedback' });
    }
});

// -------------------- Fallback for everything else --------------------
app.use((_, res) => res.status(404).send('Not found'));

// -------------------- Start the server ----------------------------------
app.listen(PORT, () => {
    console.log(`✅ Feedback server listening on http://localhost:${PORT}`);
});