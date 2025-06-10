const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');
const { db } = require('./firebase');
const FormData = require('form-data');
const axios = require('axios');

const app = express();

// Middleware
app.use(cookieParser());
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Serve static files (for generated images)
app.use('/images', express.static(path.join(__dirname, 'generated_images')));

var corsOptions = {
    origin: ['https://muse-fe.vercel.app'],
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ["Content-Type"],
    credentials: true
};

// Pinata configuration
const PINATA_JWT = process.env.PINATA_JWT; // Add your Pinata JWT token to environment variables
const PINATA_API_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';

// Ensure directories exist
const ensureDirectoryExists = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

// Initialize directories
ensureDirectoryExists(path.join(__dirname, 'generated_images'));
ensureDirectoryExists(path.join(__dirname, 'assets'));

// Function to upload file to IPFS via Pinata
const uploadToIPFS = async (filePath, fileName) => {
    try {
        if (!PINATA_JWT) {
            throw new Error('PINATA_JWT environment variable is not set');
        }

        const formData = new FormData();
        formData.append('file', fs.createReadStream(filePath));
        
        // Add metadata
        const metadata = JSON.stringify({
            name: fileName,
            keyvalues: {
                type: 'ownership-certificate',
                generated: new Date().toISOString()
            }
        });
        formData.append('pinataMetadata', metadata);

        // Add options
        const options = JSON.stringify({
            cidVersion: 1,
        });
        formData.append('pinataOptions', options);

        const response = await axios.post(PINATA_API_URL, formData, {
            maxBodyLength: 'Infinity',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${formData._boundary}`,
                'Authorization': `Bearer ${PINATA_JWT}`
            }
        });

        console.log('File uploaded to IPFS:', response.data);
        
        // Return the IPFS URL
        return {
            ipfsHash: response.data.IpfsHash,
            ipfsUrl: `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`,
            pinataUrl: `https://pinata.cloud/ipfs/${response.data.IpfsHash}`
        };

    } catch (error) {
        console.error('Error uploading to Pinata:', error.response?.data || error.message);
        throw error;
    }
};

// Function to generate personalized ownership card
const generateOwnershipCard = async (userName, tokenId, outputPath) => {
    try {
        // Register Trajan Pro fonts
        const trajanRegularPath = path.join(__dirname, 'assets', 'fonts', 'TrajanPro-Regular.otf');
        const trajanBoldPath = path.join(__dirname, 'assets', 'fonts', 'TrajanPro-Bold.otf');
        
        let fontFamily = 'serif'; // fallback
        
        try {
            if (fs.existsSync(trajanBoldPath)) {
                registerFont(trajanBoldPath, { family: 'Trajan Pro Bold' });
                fontFamily = 'Trajan Pro Bold';
                console.log('Loaded Trajan Pro Bold font');
            } else if (fs.existsSync(trajanRegularPath)) {
                registerFont(trajanRegularPath, { family: 'Trajan Pro' });
                fontFamily = 'Trajan Pro';
                console.log('Loaded Trajan Pro Regular font');
            }
        } catch (fontError) {
            console.log('Trajan Pro font not found, using fallback font:', fontError.message);
        }
        
        // Load the base image
        const baseImagePath = path.join(__dirname, 'assets', 'ownership_card_template.png');
        
        // Check if base image exists
        if (!fs.existsSync(baseImagePath)) {
            throw new Error('Base ownership card template not found. Please add ownership_card_template.png to the assets folder.');
        }

        const baseImage = await loadImage(baseImagePath);
        
        // Create canvas with same dimensions as base image
        const canvas = createCanvas(baseImage.width, baseImage.height);
        const ctx = canvas.getContext('2d');
        
        // Draw the base image
        ctx.drawImage(baseImage, 0, 0);
        
        // Configure text styling
        ctx.fillStyle = '#e5e5e6'; // White text
        ctx.textBaseline = 'middle';
        
        // Set font with Trajan Pro preference and fallbacks
        let nameFontSize = 48;
        
        // Dynamic font sizing based on name length for better fit
        if (userName.length > 20) nameFontSize = 42;
        else if (userName.length > 15) nameFontSize = 45;
        else if (userName.length > 10) nameFontSize = 48;
        
        ctx.font = `${nameFontSize}px "${fontFamily}", "Times New Roman", serif`;
        
        // Calculate positions
        const textY = canvas.height * 0.88; // Same Y position for both texts
        const nameX = canvas.width / 15; // Left margin for username
        const tokenIdX = canvas.width - (canvas.width / 15); // Right margin for token ID
        
        // Add text shadow for better readability
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.shadowBlur = 4;
        
        // Draw the username (left-aligned)
        ctx.textAlign = 'left';
        ctx.fillText(userName.toUpperCase(), nameX, textY);
        
        // Format token ID as #00001, #00010, #00500, etc.
        const formattedTokenId = tokenId ? `Card #${tokenId.toString().padStart(5, '0')}` : 'Card #00000';
        
        // Draw the token ID (right-aligned)
        ctx.textAlign = 'right';
        ctx.fillText(formattedTokenId, tokenIdX, textY);
        
        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.shadowBlur = 0;
        
        // Save the generated image
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(outputPath, buffer);
        
        return true;
    } catch (error) {
        console.error('Error generating ownership card:', error);
        throw error;
    }
};

// Store user data endpoint with image generation and IPFS upload
app.post('/api/users', cors(corsOptions), async (req, res) => {
    try {
        const { name, email, walletAddress, transactionHash, tokenId, nftMinted, mintedAt } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Create a sanitized document ID
        const docId = email.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const userRef = db.collection('users').doc(docId);
        
        // Check if user already exists
        const doc = await userRef.get();
        let ipfsData = null;
        let localImageUrl = null;
        
        // Generate personalized ownership card if this is a new mint
        if (nftMinted && transactionHash) {
            try {
                const imageName = `ownership_card_${docId}_${tokenId}_${Date.now()}.png`;
                const imagePath = path.join(__dirname, 'generated_images', imageName);
                
                // Pass tokenId to generateOwnershipCard function
                await generateOwnershipCard(name, tokenId, imagePath);
                
                // Create local URL for the generated image (as fallback)
                localImageUrl = `/images/${imageName}`;
                
                // Upload to IPFS via Pinata
                try {
                    ipfsData = await uploadToIPFS(imagePath, imageName);
                    console.log(`Generated and uploaded ownership card for ${name} with Token ID ${tokenId}:`, ipfsData.ipfsUrl);
                } catch (ipfsError) {
                    console.error('IPFS upload failed, using local storage:', ipfsError);
                    // Continue with local storage as fallback
                }
                
            } catch (imageError) {
                console.error('Failed to generate ownership card:', imageError);
                // Continue with user data storage even if image generation fails
            }
        }
        
        if (doc.exists) {
            const existingData = doc.data();
            
            // If user exists and we're updating with mint data, add to mints array
            if (nftMinted && transactionHash) {
                const newMint = {
                    transactionHash: transactionHash,
                    tokenId: tokenId,
                    mintedAt: mintedAt || new Date().toISOString(),
                    certificateIpfsHash: ipfsData?.ipfsHash,
                    certificateIpfsUrl: ipfsData?.ipfsUrl,
                    certificatePinataUrl: ipfsData?.pinataUrl,
                    ownershipCardUrl: localImageUrl
                };
                
                // Initialize mints array if it doesn't exist
                const currentMints = existingData.mints || [];
                currentMints.push(newMint);
                
                const updateData = {
                    name: name || existingData.name, // Allow name updates
                    walletAddress: walletAddress || existingData.walletAddress,
                    nftMinted: true,
                    totalMinted: currentMints.length,
                    mints: currentMints,
                    lastMintedAt: mintedAt || new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                
                await userRef.update(updateData);
                
                return res.status(200).json({ 
                    success: true,
                    message: 'User data updated with new mint information',
                    userId: docId,
                    tokenId: tokenId,
                    certificateIpfsUrl: ipfsData?.ipfsUrl,
                    ownershipCardUrl: localImageUrl,
                    ipfsHash: ipfsData?.ipfsHash,
                    totalMinted: currentMints.length
                });
            } else {
                // Just return existing user data if no mint data provided
                return res.status(200).json({ 
                    success: true,
                    message: 'User already exists',
                    userId: docId,
                    userData: existingData
                });
            }
        }

        // Add new user - name is required only for first time
        if (!name) {
            return res.status(400).json({ error: 'Name is required for new user' });
        }

        const userData = {
            name,
            email,
            createdAt: new Date().toISOString(),
            nftMinted: nftMinted || false,
            totalMinted: 0,
            mints: []
        };

        // Add optional fields if provided
        if (walletAddress) userData.walletAddress = walletAddress;
        
        // If this is a mint transaction, add to mints array
        if (nftMinted && transactionHash) {
            const newMint = {
                transactionHash: transactionHash,
                tokenId: tokenId,
                mintedAt: mintedAt || new Date().toISOString(),
                certificateIpfsHash: ipfsData?.ipfsHash,
                certificateIpfsUrl: ipfsData?.ipfsUrl,
                certificatePinataUrl: ipfsData?.pinataUrl,
                ownershipCardUrl: localImageUrl
            };
            
            userData.mints = [newMint];
            userData.totalMinted = 1;
            userData.lastMintedAt = mintedAt || new Date().toISOString();
        }

        await userRef.set(userData);

        res.status(201).json({ 
            success: true,
            message: 'User data stored successfully',
            userId: docId,
            tokenId: tokenId,
            certificateIpfsUrl: ipfsData?.ipfsUrl,
            ownershipCardUrl: localImageUrl,
            ipfsHash: ipfsData?.ipfsHash,
            totalMinted: userData.totalMinted
        });
        
    } catch (error) {
        console.error('Error storing user data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/users/wallet/:walletAddress', cors(corsOptions), async (req, res) => {
    try {
        const walletAddress = req.params.walletAddress;
        
        // Query users collection to find user with this wallet address
        const usersSnapshot = await db.collection('users')
            .where('walletAddress', '==', walletAddress)
            .limit(1)
            .get();

        if (usersSnapshot.empty) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userDoc = usersSnapshot.docs[0];
        res.json({
            id: userDoc.id,
            ...userDoc.data()
        });
    } catch (error) {
        console.error('Error fetching user by wallet:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Get user data endpoint
app.get('/api/users/:email', cors(corsOptions), async (req, res) => {
    try {
        const email = req.params.email;
        const docId = email.toLowerCase().replace(/[^a-z0-9]/g, '_');
        
        const userDoc = await db.collection('users').doc(docId).get();

        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(userDoc.data());
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all users endpoint (for admin purposes)
app.get('/api/users', cors(corsOptions), async (req, res) => {
    try {
        const usersSnapshot = await db.collection('users').get();
        const users = [];
        
        usersSnapshot.forEach(doc => {
            users.push({
                id: doc.id,
                ...doc.data()
            });
        });

        res.json({
            success: true,
            count: users.length,
            users: users
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get minted users endpoint
app.get('/api/users/minted', cors(corsOptions), async (req, res) => {
    try {
        const usersSnapshot = await db.collection('users').where('nftMinted', '==', true).get();
        const mintedUsers = [];
        
        usersSnapshot.forEach(doc => {
            mintedUsers.push({
                id: doc.id,
                ...doc.data()
            });
        });

        res.json({
            success: true,
            count: mintedUsers.length,
            users: mintedUsers
        });
    } catch (error) {
        console.error('Error fetching minted users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Endpoint to regenerate ownership card (for testing/admin purposes)
app.post('/api/generate-card', cors(corsOptions), async (req, res) => {
    try {
        const { name, email, tokenId } = req.body; // Add tokenId here
        
        if (!name || !email) {
            return res.status(400).json({ error: 'Name and email are required' });
        }
        
        const docId = email.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const imageName = `ownership_card_${docId}_${Date.now()}.png`;
        const imagePath = path.join(__dirname, 'generated_images', imageName);
        
        // Pass tokenId to generateOwnershipCard function
        await generateOwnershipCard(name, tokenId || 0, imagePath);
        const localImageUrl = `/images/${imageName}`;
        
        // Try to upload to IPFS
        let ipfsData = null;
        try {
            ipfsData = await uploadToIPFS(imagePath, imageName);
        } catch (ipfsError) {
            console.error('IPFS upload failed:', ipfsError);
        }
        
        res.json({
            success: true,
            message: 'Ownership card generated successfully',
            imageUrl: localImageUrl,
            certificateIpfsUrl: ipfsData?.ipfsUrl,
            ipfsHash: ipfsData?.ipfsHash,
            tokenId: tokenId
        });
        
    } catch (error) {
        console.error('Error generating ownership card:', error);
        res.status(500).json({ error: 'Failed to generate ownership card' });
    }
});

// New endpoint to download certificate
app.get('/api/download-certificate/:email', cors(corsOptions), async (req, res) => {
    try {
        const email = req.params.email;
        const docId = email.toLowerCase().replace(/[^a-z0-9]/g, '_');
        
        const userDoc = await db.collection('users').doc(docId).get();

        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userData = userDoc.data();
        
        if (!userData.nftMinted) {
            return res.status(400).json({ error: 'User has not minted an NFT' });
        }

        // Try to get certificate from IPFS first, then fallback to local
        if (userData.certificateIpfsUrl) {
            try {
                const response = await axios.get(userData.certificateIpfsUrl, {
                    responseType: 'arraybuffer'
                });
                
                res.set({
                    'Content-Type': 'image/png',
                    'Content-Disposition': `attachment; filename="ownership_certificate_${userData.name.replace(/[^a-z0-9]/gi, '_')}.png"`
                });
                
                return res.send(Buffer.from(response.data));
            } catch (ipfsError) {
                console.error('Failed to fetch from IPFS, trying local file:', ipfsError);
            }
        }

        // Fallback to local file
        if (userData.ownershipCardUrl) {
            const localPath = path.join(__dirname, userData.ownershipCardUrl.replace('/images/', 'generated_images/'));
            
            if (fs.existsSync(localPath)) {
                res.set({
                    'Content-Type': 'image/png',
                    'Content-Disposition': `attachment; filename="ownership_certificate_${userData.name.replace(/[^a-z0-9]/gi, '_')}.png"`
                });
                
                return res.sendFile(localPath);
            }
        }

        return res.status(404).json({ error: 'Certificate file not found' });

    } catch (error) {
        console.error('Error downloading certificate:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
