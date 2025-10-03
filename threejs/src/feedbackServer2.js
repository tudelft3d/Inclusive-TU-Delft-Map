// feedback.js
const express = require('express')
const fs = require('fs')
const path = require('path')
const app = express()

app.use(express.json()) // parses JSON bodies

const FEEDBACK_FILE = path.join(__dirname, 'feedback.log') // change path as needed

app.post('/api/feedback', (req, res) => {
    const entry = { ...req.body, ip: req.ip } // optionally capture IP
    const line = JSON.stringify(entry) + '\n'

    // Append atomically – works fine for low‑traffic sites
    fs.appendFile(FEEDBACK_FILE, line, err => {
        if (err) {
            console.error('Failed to write feedback:', err)
            return res.status(500).json({ error: 'Unable to store feedback' })
        }
        res.json({ ok: true })
    })
})

// Export for use with `pm2`, `systemd`, or just `node feedback.js`
const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Feedback endpoint listening on ${PORT}`))