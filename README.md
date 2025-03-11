# Party Photo Share

A simple and elegant web application for sharing party photos in real-time. Guests can scan a QR code to upload their photos, which are instantly displayed in a beautiful gallery.

## Features

- QR code generation for easy access
- Mobile-responsive design
- Real-time photo uploads
- Modern black and gold theme
- Image preview before upload
- Gallery with lightbox view
- Automatic gallery refresh

## Prerequisites

- Node.js (v12 or higher)
- npm (comes with Node.js)

## Installation

1. Clone this repository or download the files
2. Navigate to the project directory
3. Install dependencies:
```bash
npm install
```

## Usage

1. Start the server:
```bash
node server.js
```

2. Open your browser and visit:
```
http://localhost:3000
```

3. Share the QR code with party guests to allow them to upload photos

## Directory Structure

```
.
├── public/
│   ├── index.html      # Homepage with QR code
│   ├── upload.html     # Photo upload page
│   ├── gallery.html    # Photo gallery
│   └── styles.css      # Styling
├── uploads/            # Uploaded images storage
├── server.js          # Node.js server
├── package.json       # Dependencies
└── README.md         # This file
```

## Technologies Used

- Node.js
- Express.js
- Multer (for file uploads)
- QRCode (for QR code generation)

## License

MIT License 