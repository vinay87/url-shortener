const express = require('express');
const mongoose = require('mongoose');
const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/urlshortener';
mongoose.connect(MONGODB_URI);
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'Connection error:'));
db.once('open', () => {
    console.log('✅ MongoDB Connected');
});

// Schema
const urlSchema = new mongoose.Schema({
    shortCode: { type: String, required: true, unique: true },
    originalUrl: { type: String, required: true },
    clicks: { type: Number, default: 0 }
});

const Url = mongoose.model('Url', urlSchema);

// API: Get all URLs
app.get('/api/urls', async (req, res) => {
    const urls = await Url.find({});
    res.json(urls);
});

// API: Create URL
app.post('/api/create', async (req, res) => {
    let { code, url } = req.body;

    function generateCode() {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars[Math.floor(Math.random() * chars.length)];
        }
        return result;
    }

    if (!code) {
        code = generateCode();
        while (await Url.findOne({ shortCode: code })) {
            code = generateCode();
        }
    } else {
        const exists = await Url.findOne({ shortCode: code });
        if (exists) {
            return res.json({ error: 'Code already exists' });
        }
    }

    const newUrl = new Url({ shortCode: code, originalUrl: url });
    await newUrl.save();
    res.json({ success: true, code: code });
});

// API: Update URL
app.put('/api/update/:oldCode', async (req, res) => {
    const { oldCode } = req.params;
    const { newCode, newUrl } = req.body;

    const entry = await Url.findOne({ shortCode: oldCode });
    if (!entry) {
        return res.json({ error: 'Not found' });
    }

    if (newCode && newCode !== oldCode) {
        const exists = await Url.findOne({ shortCode: newCode });
        if (exists) {
            return res.json({ error: 'New code already exists' });
        }
        entry.shortCode = newCode;
    }
    if (newUrl) {
        entry.originalUrl = newUrl;
    }

    await entry.save();
    res.json({ success: true });
});

// API: Delete URL
app.delete('/api/delete/:code', async (req, res) => {
    await Url.findOneAndDelete({ shortCode: req.params.code });
    res.json({ success: true });
});

// IMPORTANT: Redirect with click tracking - GUNSHOT SOLUTION
app.get('/go/:code', async (req, res) => {
    const code = req.params.code;
    console.log('Redirect requested for:', code);

    const entry = await Url.findOne({ shortCode: code });

    if (!entry) {
        return res.send('URL not found. <a href="/">Go Home</a>');
    }

    entry.clicks = entry.clicks + 1;
    await entry.save();

    console.log('Click recorded. New count:', entry.clicks);
    res.redirect(entry.originalUrl);
});

// Keep old route for compatibility
app.get('/:code', async (req, res) => {
    const code = req.params.code;
    if (code === 'favicon.ico') return;

    const entry = await Url.findOne({ shortCode: code });

    if (!entry) {
        return res.status(404).send('Not found');
    }

    entry.clicks = entry.clicks + 1;
    await entry.save();
    res.redirect(entry.originalUrl);
});

app.listen(PORT, () => {
    console.log('\n========================================');
    console.log('Server: http://localhost:' + PORT);
    console.log('========================================\n');
});