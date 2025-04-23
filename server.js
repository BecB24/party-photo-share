const express = require('express');
const multer = require('multer');
const path = require('path');
const QRCode = require('qrcode');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Configure Cloudinary
cloudinary.config({
    cloud_name: 'dtrnwnuju',
    api_key: '983297892259464',
    api_secret: 'OsMT1S1CXEayXAUFK9y6pI07HX8'
});

const app = express();
const port = process.env.PORT || 3002;

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
        }
    });
});

// Upload endpoint
app.post('/api/upload', upload.single('image'), async (req, res) => {
    console.log('Upload request received');
    
    if (!req.file) {
        console.log('No file in request');
        return res.status(400).json({
            success: false,
            message: 'No file uploaded'
        });
    }

    try {
        console.log('Processing file:', {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size
        });

        // Create data URI from buffer
        const b64 = Buffer.from(req.file.buffer).toString('base64');
        const dataURI = `data:${req.file.mimetype};base64,${b64}`;

        console.log('Uploading to Cloudinary...');
        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(dataURI, {
            resource_type: 'auto',
            folder: 'party-photos',
            allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
            transformation: [
                { quality: 'auto:good' },
                { fetch_format: 'auto' }
            ]
        });

        console.log('Cloudinary upload successful:', {
            url: result.secure_url,
            public_id: result.public_id
        });

        res.json({
            success: true,
            message: 'File uploaded successfully',
            data: {
                url: result.secure_url,
                publicId: result.public_id
            }
        });
    } catch (error) {
        console.error('Upload error:', {
            message: error.message,
            code: error.http_code || error.code,
            stack: error.stack
        });

        res.status(500).json({
            success: false,
            message: `Upload failed: ${error.message}`,
            error: {
                code: error.http_code || error.code,
                message: error.message
            }
        });
    }
});

// Get images endpoint
app.get('/api/images', async (req, res) => {
    try {
        console.log('Fetching images from Cloudinary...');
        
        const result = await cloudinary.search
            .expression('folder:party-photos')
            .sort_by('created_at', 'desc')
            .max_results(100)
            .execute();

        console.log(`Found ${result.total_count} images`);
        
        const images = result.resources.map(resource => ({
            url: resource.secure_url,
            publicId: resource.public_id,
            timestamp: resource.created_at
        }));

        res.json(images);
    } catch (error) {
        console.error('Error fetching images from Cloudinary:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching images',
            error: error.message
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