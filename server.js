const express = require('express');
const multer = require('multer');
const path = require('path');
const QRCode = require('qrcode');
const cloudinary = require('cloudinary').v2;
const mongoose = require('mongoose');
require('dotenv').config();

// Configure Cloudinary
cloudinary.config({
    cloud_name: 'dtrnwnuju',
    api_key: '983297892259464',
    api_secret: 'OsMT1S1CXEayXAUFK9y6pI07HX8'
});

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error('MongoDB connection string not found in environment variables');
}
mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Define Image Schema
const imageSchema = new mongoose.Schema({
    url: String,
    timestamp: { type: Date, default: Date.now },
    publicId: String
});

const Image = mongoose.model('Image', imageSchema);

const app = express();
const port = process.env.PORT || 3001;

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Enable JSON body parsing
app.use(express.json());

// Serve static files
app.use(express.static('public'));

// Health check endpoint
app.get('/api/health', (req, res) => {
    const config = cloudinary.config();
    res.json({ 
        status: 'ok',
        cloudinary: {
            configured: !!config.cloud_name,
            cloud_name: config.cloud_name
        },
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// Upload endpoint
app.post('/api/upload', upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: 'No file uploaded'
        });
    }

    try {
        // Create data URI from buffer
        const b64 = Buffer.from(req.file.buffer).toString('base64');
        const dataURI = `data:${req.file.mimetype};base64,${b64}`;

        // Upload to Cloudinary with specific options
        const result = await cloudinary.uploader.upload(dataURI, {
            resource_type: 'auto',
            folder: 'party-photos',
            allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
            transformation: [
                { quality: 'auto:good' },
                { fetch_format: 'auto' }
            ]
        });

        // Create and save new image document
        const image = new Image({
            url: result.secure_url,
            publicId: result.public_id
        });
        await image.save();

        res.json({
            success: true,
            message: 'File uploaded successfully',
            data: image
        });
    } catch (error) {
        console.error('Upload error:', {
            message: error.message,
            code: error.http_code || error.code
        });

        res.status(500).json({
            success: false,
            message: `Upload failed: ${error.message}`
        });
    }
});

// Get images endpoint
app.get('/api/images', async (req, res) => {
    try {
        const images = await Image.find().sort({ timestamp: -1 });
        res.json(images);
    } catch (error) {
        console.error('Error fetching images:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching images'
        });
    }
});

// QR Code endpoint
app.get('/api/qr-code', async (req, res) => {
    try {
        const host = req.get('host');
        const protocol = req.protocol;
        const url = `${protocol}://${host}/upload.html`;
        const qrCode = await QRCode.toDataURL(url);
        res.json({ qrCode });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Error generating QR code'
        });
    }
});

// Catch-all route for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server in development
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
}

module.exports = app; 