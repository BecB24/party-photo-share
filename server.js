const express = require('express');
const multer = require('multer');
const path = require('path');
const QRCode = require('qrcode');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

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

// In-memory store for image URLs (replace with a database in production)
let imageUrls = [];

// Serve static files
app.use(express.static('public'));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        cloudinary: {
            configured: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
        }
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

        // Store the URL
        const imageData = {
            url: result.secure_url,
            timestamp: new Date(),
            publicId: result.public_id
        };
        imageUrls.push(imageData);

        res.json({
            success: true,
            message: 'File uploaded successfully',
            data: imageData
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
app.get('/api/images', (req, res) => {
    res.json(imageUrls);
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