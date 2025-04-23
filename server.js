const express = require('express');
const multer = require('multer');
const path = require('path');
const QRCode = require('qrcode');
const cloudinary = require('cloudinary').v2;
const mysql = require('mysql2/promise');
require('dotenv').config();

// Configure Cloudinary
cloudinary.config({
    cloud_name: 'dtrnwnuju',
    api_key: '983297892259464',
    api_secret: 'OsMT1S1CXEayXAUFK9y6pI07HX8'
});

// MySQL connection
const pool = mysql.createPool({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE,
    ssl: {
        rejectUnauthorized: true
    }
});

// Test database connection
const testConnection = async () => {
    try {
        const connection = await pool.getConnection();
        console.log('Successfully connected to MySQL database');
        
        // Create images table if it doesn't exist
        await connection.query(`
            CREATE TABLE IF NOT EXISTS images (
                id INT AUTO_INCREMENT PRIMARY KEY,
                url VARCHAR(255) NOT NULL,
                publicId VARCHAR(255) NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        connection.release();
        return true;
    } catch (error) {
        console.error('Database connection error:', error);
        return false;
    }
};

// Initialize database
testConnection();

const app = express();

// Test database endpoint
app.get('/api/test-db', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        // Try to write a test record
        await connection.query(
            'INSERT INTO images (url, publicId) VALUES (?, ?)',
            ['test-url', 'test-id']
        );
        
        // Try to read it back
        const [rows] = await connection.query(
            'SELECT * FROM images WHERE publicId = ?',
            ['test-id']
        );
        
        // Clean up the test record
        await connection.query(
            'DELETE FROM images WHERE publicId = ?',
            ['test-id']
        );
        
        connection.release();
        
        res.json({
            success: true,
            message: 'Database connection test successful',
            details: {
                writeTest: 'passed',
                readTest: rows.length > 0 ? 'passed' : 'failed'
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Database connection test failed',
            error: error.message
        });
    }
});

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
app.get('/api/health', async (req, res) => {
    const config = cloudinary.config();
    let dbConnected = false;
    
    try {
        const connection = await pool.getConnection();
        dbConnected = true;
        connection.release();
    } catch (error) {
        console.error('Health check database error:', error);
    }
    
    res.json({ 
        status: 'ok',
        cloudinary: {
            configured: !!config.cloud_name,
            cloud_name: config.cloud_name
        },
        database: dbConnected ? 'connected' : 'disconnected'
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

        // Save to database
        const connection = await pool.getConnection();
        await connection.query(
            'INSERT INTO images (url, publicId) VALUES (?, ?)',
            [result.secure_url, result.public_id]
        );
        connection.release();

        res.json({
            success: true,
            message: 'File uploaded successfully',
            data: {
                url: result.secure_url,
                publicId: result.public_id
            }
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            message: `Upload failed: ${error.message}`
        });
    }
});

// Get images endpoint
app.get('/api/images', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query(
            'SELECT * FROM images ORDER BY timestamp DESC'
        );
        connection.release();
        
        res.json(rows);
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