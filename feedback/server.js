// feedback.js
const express = require('express')
const fs = require('fs')
const path = require('path')
const Joi = require('joi');   // optional validation

const app = express()

app.use(express.json()) // parses JSON bodies

const FEEDBACK_FILE = path.join(__dirname, 'feedback.log') // change path as needed

// Validation schema
const feedbackSchema = Joi.object({
    suggestion: Joi.string().trim().min(1).max(2000).required(),
    type: Joi.string().allow(null, ''),
    location: Joi.string().allow(null, ''),
    email: Joi.string().email({ tlds: { allow: false } }).required(),
    submittedAt: Joi.string().isoDate(),
});

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

// Export for use with `pm2`, `systemd`, or just `node feedback.js`
const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Feedback endpoint listening on ${PORT}`))