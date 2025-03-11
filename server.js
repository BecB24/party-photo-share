const express = require('express');
const multer = require('multer');
const path = require('path');
const QRCode = require('qrcode');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3001;

// Set up storage for uploaded files
const storage = multer.memoryStorage(); // Change to memory storage for Vercel
const upload = multer({ storage: storage });

// Serve static files
app.use(express.static('public'));

// Routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.post('/api/upload', upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    // For demo purposes, we'll just acknowledge the upload
    // In production, you should use a proper storage service like S3 or Cloudinary
    res.json({
        success: true,
        message: 'File received successfully'
    });
});

app.get('/api/images', (req, res) => {
    // For demo purposes, return an empty array
    // In production, you should fetch from your storage service
    res.json([]);
});

// Generate QR Code
app.get('/api/qr-code', async (req, res) => {
    try {
        const host = req.get('host');
        const protocol = req.protocol;
        const url = `${protocol}://${host}/upload.html`;
        const qrCode = await QRCode.toDataURL(url);
        res.json({ qrCode });
    } catch (err) {
        res.status(500).send('Error generating QR code');
    }
});

// Handle all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Only listen if we're running directly (not in Vercel)
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
}

module.exports = app; 