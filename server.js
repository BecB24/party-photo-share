const express = require('express');
const multer = require('multer');
const path = require('path');
const QRCode = require('qrcode');
const cloudinary = require('cloudinary').v2;
const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://becb24:Bec240894@cluster0.mongodb.net/party-photos?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('MongoDB connection error:', err);
});

// Define Image Schema
const imageSchema = new mongoose.Schema({
    url: { type: String, required: true },
    filename: { type: String, required: true },
    uploadDate: { type: Date, default: Date.now },
    publicId: String,
    resourceType: { type: String, enum: ['image', 'video'] }
});

const Image = mongoose.model('Image', imageSchema);

// Configure Cloudinary with environment variables
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dtrnwnuju',
    api_key: process.env.CLOUDINARY_API_KEY || '983297892259464',
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const app = express();
const port = process.env.PORT || 3002;

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit for videos
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
app.post('/api/upload', upload.single('media'), async (req, res) => {
    console.log('Upload request received');
    
    if (!req.file) {
        console.error('No file received in request');
        return res.status(400).json({
            success: false,
            message: 'No file uploaded'
        });
    }

    try {
        console.log(`Processing file: ${req.file.originalname}, size: ${req.file.size} bytes, type: ${req.file.mimetype}`);
        
        // Create data URI from buffer
        const b64 = Buffer.from(req.file.buffer).toString('base64');
        const dataURI = `data:${req.file.mimetype};base64,${b64}`;
        console.log('Data URI created successfully');

        // Determine resource type based on mimetype
        const isVideo = req.file.mimetype.startsWith('video/');
        console.log(`Resource type: ${isVideo ? 'video' : 'image'}`);
        
        // Upload to Cloudinary with appropriate settings
        console.log('Initiating Cloudinary upload...');
        const result = await cloudinary.uploader.upload(dataURI, {
            folder: 'party-photos',
            resource_type: isVideo ? 'video' : 'image',
            chunk_size: 6000000
        });
        console.log('Cloudinary upload successful:', result.secure_url);

        // Save metadata to MongoDB
        const imageDoc = new Image({
            url: result.secure_url,
            filename: req.file.originalname,
            publicId: result.public_id,
            resourceType: isVideo ? 'video' : 'image'
        });
        await imageDoc.save();
        console.log('Metadata saved to MongoDB');

        res.json({
            success: true,
            message: 'File uploaded successfully',
            data: {
                url: result.secure_url,
                publicId: result.public_id,
                resourceType: result.resource_type
            }
        });
    } catch (error) {
        console.error('Upload error details:', {
            message: error.message,
            stack: error.stack,
            file: req.file ? {
                name: req.file.originalname,
                size: req.file.size,
                type: req.file.mimetype
            } : 'No file data'
        });
        
        res.status(500).json({
            success: false,
            message: `Upload failed: ${error.message}`
        });
    }
});

// Get media endpoint
app.get('/api/images', async (req, res) => {
    try {
        console.log('Fetching media from MongoDB...');
        
        const allMedia = await Image.find({})
            .sort({ uploadDate: -1 })
            .limit(100)
            .lean();

        console.log(`Found ${allMedia.length} media items`);
        res.json(allMedia);
    } catch (error) {
        console.error('Error fetching media:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching media',
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

// Test endpoint for MongoDB connection
app.get('/api/test-db', async (req, res) => {
  try {
    // Get current connection state
    const state = mongoose.connection.readyState;
    const stateMap = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };

    // Try to write a test document
    const testDoc = new Image({
      url: 'test-url',
      filename: 'test-file',
      uploadDate: new Date()
    });
    await testDoc.save();

    // Try to read it back
    const readDoc = await Image.findById(testDoc._id);

    // Clean up by deleting the test document
    await Image.findByIdAndDelete(testDoc._id);

    res.json({
      success: true,
      connectionState: stateMap[state],
      databaseName: mongoose.connection.name,
      writeTest: 'success',
      readTest: readDoc ? 'success' : 'failed',
      message: 'MongoDB connection test successful'
    });
  } catch (error) {
    console.error('MongoDB test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      connectionState: stateMap[mongoose.connection.readyState],
      message: 'MongoDB connection test failed'
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