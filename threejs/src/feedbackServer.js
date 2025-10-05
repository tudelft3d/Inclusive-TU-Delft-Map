// feedback-server.js
// ------------------------------------------------------------
// Minimal Express server that receives POST /api/feedback
// and allows CORS from http://127.0.0.1:5173 (Vite dev server)
// ------------------------------------------------------------
const express = require('express');
const cors    = require('cors');
const fs      = require('fs').promises;
const path    = require('path');
const Joi     = require('joi');   // optional validation library

const app = express();

// -------------------- Config --------------------
const PORT      = process.env.PORT || 3001;
// write logs to ../feedback/feedback.log so it matches your feedback folder
const LOG_FILE  = path.join(__dirname, '..', 'feedback', 'feedback.log');
const ALLOWED_ORIGIN = 'http://127.0.0.1:5173'; // Vite dev server

// -------------------- Middleware --------------------
app.use(express.json()); // parses JSON bodies

// CORS – only allow the Vite dev origin (change to '*' for any origin)
app.use(cors({
  origin: ALLOWED_ORIGIN,
  methods: ['POST'],
  allowedHeaders: ['Content-Type'],
}));

// -------------------- Validation schema (optional) --------------------
const feedbackSchema = Joi.object({
  message: Joi.string().trim().min(1).max(2000).required(),
  email:   Joi.string().email({ tlds: { allow: false } }).optional(),
  rating:  Joi.number().integer().min(1).max(5).optional(),
  pageUrl: Joi.string().uri().optional(),
}).unknown(true); // allow extra fields (e.g. type, location, submittedAt)

// -------------------- Route --------------------
app.post('/api/feedback', async (req, res) => {
  // ---- Validate payload (if you don’t want validation, just skip this block) ----
  const { error, value } = feedbackSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({ error: error.details.map(d => d.message) });
  }

  // ---- Build log entry -------------------------------------------------------
  const entry = {
    ...value,
    receivedAt: new Date().toISOString(),
    ip: req.ip,
  };

  // ---- Persist to file -------------------------------------------------------
  try {
    // Ensure the folder exists (once is enough, but safe to call each time)
    await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
    await fs.appendFile(LOG_FILE, JSON.stringify(entry) + '\n', 'utf8');
    return res.status(200).json({ ok: true });
  } catch (writeErr) {
    console.error('❌ Failed to write feedback:', writeErr);
    return res.status(500).json({ error: 'Unable to store feedback' });
  }
});

// -------------------- Fallback for anything else --------------------
app.use((_, res) => res.status(404).send('Not found'));

// -------------------- Start server -----------------------------------------
app.listen(PORT, () => {
  console.log(`✅ Feedback server listening on http://127.0.0.1:${PORT}`);
});