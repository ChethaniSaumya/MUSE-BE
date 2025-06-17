const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');
const { db } = require('./firebase');
const FormData = require('form-data');
const axios = require('axios');
const archiver = require('archiver');
const app = express();
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider('https://rpc.v4.testnet.pulsechain.com'));

const contractABI = [
    {
        "inputs": [
            {
                "internalType": "string",
                "name": "_name",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "_symbol",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "_initBaseURI",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "_initNotRevealedUri",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "_contractURI",
                "type": "string"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "operator",
                "type": "address"
            }
        ],
        "name": "OperatorNotAllowed",
        "type": "error"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "owner",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "approved",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "uint256",
                "name": "tokenId",
                "type": "uint256"
            }
        ],
        "name": "Approval",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "owner",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "operator",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "bool",
                "name": "approved",
                "type": "bool"
            }
        ],
        "name": "ApprovalForAll",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "previousOwner",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "newOwner",
                "type": "address"
            }
        ],
        "name": "OwnershipTransferred",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "from",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "to",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "uint256",
                "name": "tokenId",
                "type": "uint256"
            }
        ],
        "name": "Transfer",
        "type": "event"
    },
    {
        "inputs": [],
        "name": "MAX_SUPPLY",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "OPERATOR_FILTER_REGISTRY",
        "outputs": [
            {
                "internalType": "contract IOperatorFilterRegistry",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "additionalPrice",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "operator",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "tokenId",
                "type": "uint256"
            }
        ],
        "name": "approve",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "owner",
                "type": "address"
            }
        ],
        "name": "balanceOf",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "baseExtension",
        "outputs": [
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "basePrice",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "baseURI",
        "outputs": [
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_salePrice",
                "type": "uint256"
            }
        ],
        "name": "calculateRoyalty",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "contractURI",
        "outputs": [
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "tokenId",
                "type": "uint256"
            }
        ],
        "name": "getApproved",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "wallet",
                "type": "address"
            }
        ],
        "name": "getWalletTokenCount",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "wallet",
                "type": "address"
            }
        ],
        "name": "getWalletTokenIds",
        "outputs": [
            {
                "internalType": "uint256[]",
                "name": "",
                "type": "uint256[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "owner",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "operator",
                "type": "address"
            }
        ],
        "name": "isApprovedForAll",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "max_per_wallet",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_mintAmount",
                "type": "uint256"
            },
            {
                "internalType": "string",
                "name": "name",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "email",
                "type": "string"
            }
        ],
        "name": "mint",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "name",
        "outputs": [
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "notRevealedUri",
        "outputs": [
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "owner",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "tokenId",
                "type": "uint256"
            }
        ],
        "name": "ownerOf",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bool",
                "name": "_state",
                "type": "bool"
            }
        ],
        "name": "pause",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "paused",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "publicSaleCost",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "public_mint_status",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "renounceOwnership",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "revealed",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_tokenId",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "_salePrice",
                "type": "uint256"
            }
        ],
        "name": "royaltyInfo",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "from",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "to",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "tokenId",
                "type": "uint256"
            }
        ],
        "name": "safeTransferFrom",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "from",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "to",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "tokenId",
                "type": "uint256"
            },
            {
                "internalType": "bytes",
                "name": "data",
                "type": "bytes"
            }
        ],
        "name": "safeTransferFrom",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_additionalPrice",
                "type": "uint256"
            }
        ],
        "name": "setAdditionalPrice",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "operator",
                "type": "address"
            },
            {
                "internalType": "bool",
                "name": "approved",
                "type": "bool"
            }
        ],
        "name": "setApprovalForAll",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "string",
                "name": "_newBaseExtension",
                "type": "string"
            }
        ],
        "name": "setBaseExtension",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_basePrice",
                "type": "uint256"
            }
        ],
        "name": "setBasePrice",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "string",
                "name": "_newBaseURI",
                "type": "string"
            }
        ],
        "name": "setBaseURI",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "string",
                "name": "_contractURI",
                "type": "string"
            }
        ],
        "name": "setContractURI",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_initialIssuancePercentage",
                "type": "uint256"
            }
        ],
        "name": "setInitialIssuancePercentage",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_keptInTheContractPercentage",
                "type": "uint256"
            }
        ],
        "name": "setKeptInTheContractPercentage",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_MAX_SUPPLY",
                "type": "uint256"
            }
        ],
        "name": "setMAX_SUPPLY",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_max_per_wallet",
                "type": "uint256"
            }
        ],
        "name": "setMax_per_wallet",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "string",
                "name": "_notRevealedURI",
                "type": "string"
            }
        ],
        "name": "setNotRevealedURI",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_publicSaleCost",
                "type": "uint256"
            }
        ],
        "name": "setPublicSaleCost",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bool",
                "name": "_public_mint_status",
                "type": "bool"
            }
        ],
        "name": "setPublic_mint_status",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_royaltyAddress",
                "type": "address"
            }
        ],
        "name": "setRoyaltyAddress",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_receiver",
                "type": "address"
            },
            {
                "internalType": "uint96",
                "name": "_royaltyFeesInBips",
                "type": "uint96"
            }
        ],
        "name": "setRoyaltyInfo",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bytes4",
                "name": "interfaceId",
                "type": "bytes4"
            }
        ],
        "name": "supportsInterface",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "symbol",
        "outputs": [
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "toggleReveal",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "name": "tokenIdToEmail",
        "outputs": [
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "name": "tokenIdToName",
        "outputs": [
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "tokenId",
                "type": "uint256"
            }
        ],
        "name": "tokenURI",
        "outputs": [
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "totalSupply",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "from",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "to",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "tokenId",
                "type": "uint256"
            }
        ],
        "name": "transferFrom",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "newOwner",
                "type": "address"
            }
        ],
        "name": "transferOwnership",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "name": "userMinted",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "name": "walletToTokenIds",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "withdraw",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    }
];

const contractAddress = '0xE921E4af47f7dCb6Ae34720D2A78ED92e62572BD'; // Replace with your contract address

// Create contract instance
const nftContract = new web3.eth.Contract(contractABI, contractAddress);

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
    origin: ['https://muse-fe.vercel.app', 'http://localhost:3000', 'http://localhost:3001'],
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    exposedHeaders: ['Content-Type', 'Content-Disposition', 'Content-Length'],
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
// Replace the entire /api/users POST endpoint in your server.js with this:

app.post('/api/users', cors(corsOptions), async (req, res) => {
    try {
        const { 
            name, 
            email, 
            walletAddress, 
            transactionHash, 
            tokenId, 
            nftMinted, 
            mintedAt, 
            ageConfirmed, 
            termsAccepted,
            subscribe 
        } = req.body;

        console.log('Received subscription value:', subscribe); // Debug log

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

                await generateOwnershipCard(name, tokenId, imagePath);
                localImageUrl = `/images/${imageName}`;

                // Upload to IPFS via Pinata
                try {
                    ipfsData = await uploadToIPFS(imagePath, imageName);
                    console.log(`Generated and uploaded ownership card for ${name} with Token ID ${tokenId}:`, ipfsData.ipfsUrl);

                    // Store certificate in certificates collection
                    await db.collection('certificates').doc(tokenId.toString()).set({
                        tokenId: tokenId.toString(),
                        ipfsUrl: ipfsData.ipfsUrl
                    });
                } catch (ipfsError) {
                    console.error('IPFS upload failed, using local storage:', ipfsError);
                    // Store with just local URL
                    if (ipfsData) {
                        await db.collection('certificates').doc(tokenId.toString()).set({
                            tokenId: tokenId.toString(),
                            ipfsUrl: ipfsData.ipfsUrl
                        });
                    }
                }
            } catch (imageError) {
                console.error('Failed to generate ownership card:', imageError);
            }
        }

        if (doc.exists) {
            const existingData = doc.data();

            if (nftMinted && transactionHash) {
                const newMint = {
                    transactionHash: transactionHash,
                    tokenId: tokenId,
                    mintedAt: mintedAt || new Date().toISOString(),
                    certificateIpfsHash: ipfsData?.ipfsHash,
                    certificateIpfsUrl: ipfsData?.ipfsUrl,
                    certificatePinataUrl: ipfsData?.pinataUrl,
                    ownershipCardUrl: localImageUrl,
                    termsAccepted: termsAccepted || true,
                    termsAcceptedAt: new Date().toISOString(),
                    ageConfirmed: ageConfirmed || false,
                    ageConfirmedAt: ageConfirmed ? new Date().toISOString() : null,
                    // Add subscription data to this specific mint
                    subscribeNewsletter: subscribe || false,
                    subscribeNewsletterAt: subscribe ? new Date().toISOString() : null
                };

                const currentMints = existingData.mints || [];
                currentMints.push(newMint);

                const updateData = {
                    name: name || existingData.name,
                    walletAddress: walletAddress || existingData.walletAddress,
                    nftMinted: true,
                    totalMinted: currentMints.length,
                    mints: currentMints,
                    lastMintedAt: mintedAt || new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    // Add subscription to user level (true if any mint has subscription or if current mint has subscription)
                    subscribeNewsletter: subscribe || existingData.subscribeNewsletter || false,
                    subscribeNewsletterAt: subscribe ? new Date().toISOString() : (existingData.subscribeNewsletterAt || null)
                };

                console.log('Updating user with subscription:', updateData.subscribeNewsletter); // Debug log

                await userRef.update(updateData);

                return res.status(200).json({
                    success: true,
                    message: 'User data updated with new mint information',
                    userId: docId,
                    tokenId: tokenId,
                    certificateIpfsUrl: ipfsData?.ipfsUrl,
                    ownershipCardUrl: localImageUrl,
                    ipfsHash: ipfsData?.ipfsHash,
                    totalMinted: currentMints.length,
                    subscribeNewsletter: subscribe || false
                });
            } else {
                return res.status(200).json({
                    success: true,
                    message: 'User already exists',
                    userId: docId,
                    userData: existingData
                });
            }
        }

        // Add new user
        if (!name) {
            return res.status(400).json({ error: 'Name is required for new user' });
        }

        const userData = {
            name,
            email,
            createdAt: new Date().toISOString(),
            nftMinted: nftMinted || false,
            totalMinted: 0,
            mints: [],
            termsAccepted: termsAccepted || (nftMinted || false),
            termsAcceptedAt: (termsAccepted || nftMinted) ? new Date().toISOString() : null,
            ageConfirmed: ageConfirmed || false,
            ageConfirmedAt: ageConfirmed ? new Date().toISOString() : null,
            // Add subscription data for new user
            subscribeNewsletter: subscribe || false,
            subscribeNewsletterAt: subscribe ? new Date().toISOString() : null
        };

        if (walletAddress) userData.walletAddress = walletAddress;

        if (nftMinted && transactionHash) {
            const newMint = {
                transactionHash: transactionHash,
                tokenId: tokenId,
                mintedAt: mintedAt || new Date().toISOString(),
                certificateIpfsHash: ipfsData?.ipfsHash,
                certificateIpfsUrl: ipfsData?.ipfsUrl,
                certificatePinataUrl: ipfsData?.pinataUrl,
                ownershipCardUrl: localImageUrl,
                termsAccepted: termsAccepted || true,
                termsAcceptedAt: new Date().toISOString(),
                ageConfirmed: ageConfirmed || false,
                ageConfirmedAt: ageConfirmed ? new Date().toISOString() : null,
                // Add subscription data to the mint record
                subscribeNewsletter: subscribe || false,
                subscribeNewsletterAt: subscribe ? new Date().toISOString() : null
            };

            userData.mints = [newMint];
            userData.totalMinted = 1;
            userData.lastMintedAt = mintedAt || new Date().toISOString();
        }

        console.log('Creating new user with subscription:', userData.subscribeNewsletter); // Debug log

        await userRef.set(userData);

        res.status(201).json({
            success: true,
            message: 'User data stored successfully',
            userId: docId,
            tokenId: tokenId,
            certificateIpfsUrl: ipfsData?.ipfsUrl,
            ownershipCardUrl: localImageUrl,
            ipfsHash: ipfsData?.ipfsHash,
            totalMinted: userData.totalMinted,
            subscribeNewsletter: subscribe || false
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

app.put('/api/users/:email/update-name', cors(corsOptions), async (req, res) => {
    try {
        const { email } = req.params;
        const { newName, tokenId } = req.body;

        if (!newName || !tokenId) {
            return res.status(400).json({ error: 'New name and token ID are required' });
        }

        const docId = email.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const userRef = db.collection('users').doc(docId);

        // Check if user exists
        const doc = await userRef.get();
        if (!doc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userData = doc.data();

        // Generate new certificate with updated name
        const imageName = `ownership_card_${docId}_${tokenId}_${Date.now()}.png`;
        const imagePath = path.join(__dirname, 'generated_images', imageName);

        await generateOwnershipCard(newName, tokenId, imagePath);
        const localImageUrl = `/images/${imageName}`;

        // Try to upload to IPFS
        let ipfsData = null;
        try {
            ipfsData = await uploadToIPFS(imagePath, imageName);
        } catch (ipfsError) {
            console.error('IPFS upload failed:', ipfsError);
        }

        // Update certificate in certificates collection
        if (ipfsData) {
            await db.collection('certificates').doc(tokenId.toString()).set({
                tokenId: tokenId.toString(),
                ipfsUrl: ipfsData.ipfsUrl
            });
        }

        // Update user data
        const updateData = {
            name: newName,
            updatedAt: new Date().toISOString()
        };

        // Update the specific mint record if it exists in mints array
        if (userData.mints && Array.isArray(userData.mints)) {
            const updatedMints = userData.mints.map(mint => {
                if (mint.tokenId === tokenId) {
                    return {
                        ...mint,
                        certificateIpfsHash: ipfsData?.ipfsHash || mint.certificateIpfsHash,
                        certificateIpfsUrl: ipfsData?.ipfsUrl || mint.certificateIpfsUrl,
                        certificatePinataUrl: ipfsData?.pinataUrl || mint.certificatePinataUrl,
                        ownershipCardUrl: localImageUrl,
                        updatedAt: new Date().toISOString()
                    };
                }
                return mint;
            });
            updateData.mints = updatedMints;
        }

        // Update legacy fields if they exist
        if (userData.certificateIpfsUrl || userData.ownershipCardUrl) {
            updateData.certificateIpfsHash = ipfsData?.ipfsHash;
            updateData.certificateIpfsUrl = ipfsData?.ipfsUrl;
            updateData.certificatePinataUrl = ipfsData?.pinataUrl;
            updateData.ownershipCardUrl = localImageUrl;
        }

        await userRef.update(updateData);

        res.json({
            success: true,
            message: 'User name and certificate updated successfully',
            newName: newName,
            certificateIpfsUrl: ipfsData?.ipfsUrl,
            ownershipCardUrl: localImageUrl,
            ipfsHash: ipfsData?.ipfsHash
        });

    } catch (error) {
        console.error('Error updating user name:', error);
        res.status(500).json({ error: 'Failed to update user name' });
    }
});

app.post('/api/certificates', cors(corsOptions), async (req, res) => {
    try {
        const { tokenId, ipfsUrl } = req.body;

        if (!tokenId || !ipfsUrl) {
            return res.status(400).json({ error: 'Token ID and IPFS URL are required' });
        }

        const certRef = db.collection('certificates').doc(tokenId.toString());

        await certRef.set({
            tokenId: tokenId.toString(),
            ipfsUrl: ipfsUrl
        });

        res.status(201).json({
            success: true,
            message: 'Certificate stored successfully',
            tokenId: tokenId
        });

    } catch (error) {
        console.error('Error storing certificate:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/certificates/batch', cors(corsOptions), async (req, res) => {
    try {
        const { tokenIds } = req.body;

        if (!tokenIds || !Array.isArray(tokenIds)) {
            return res.status(400).json({ error: 'Array of token IDs is required' });
        }

        const certificates = [];

        // Use Promise.all to fetch all certificates in parallel
        await Promise.all(tokenIds.map(async (tokenId) => {
            const certDoc = await db.collection('certificates').doc(tokenId.toString()).get();
            if (certDoc.exists) {
                certificates.push(certDoc.data());
            }
        }));

        res.json({
            success: true,
            count: certificates.length,
            certificates: certificates
        });
    } catch (error) {
        console.error('Error fetching batch certificates:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// New endpoint to download archive (all certificates + Autograph and Song mp3 folder)
// Replace the existing /api/users/:email/download-archive endpoint with this version
app.get('/api/users/:email/download-archive', cors(corsOptions), async (req, res) => {
    try {
        const email = req.params.email;
        const docId = email.toLowerCase().replace(/[^a-z0-9]/g, '_');

        console.log(`Archive download requested for email: ${email}`);

        // 1. Get user data to verify existence
        const userDoc = await db.collection('users').doc(docId).get();
        if (!userDoc.exists) {
            console.log('User not found');
            return res.status(404).json({ error: 'User not found' });
        }

        const userData = userDoc.data();
        console.log(`User found: ${userData.name}`);

        if (!userData.walletAddress) {
            console.log('No wallet address found for user');
            return res.status(400).json({ error: 'No wallet address associated with this user' });
        }

        // 2. Get CURRENTLY OWNED token IDs from blockchain
        let currentlyOwnedTokenIds = [];
        let usedBlockchainData = false;

        try {
            currentlyOwnedTokenIds = await getCurrentlyOwnedTokenIds(userData.walletAddress);
            usedBlockchainData = true;
            console.log(`Found ${currentlyOwnedTokenIds.length} currently owned token IDs from blockchain:`, currentlyOwnedTokenIds);
        } catch (blockchainError) {
            console.error('Error checking blockchain for owned tokens:', blockchainError.message);

            // Fallback: Check individual tokens from user's mint history
            if (userData.mints && Array.isArray(userData.mints)) {
                console.log('Falling back to individual token ownership verification');

                const verificationPromises = userData.mints.map(async (mint) => {
                    if (mint.tokenId) {
                        try {
                            const isOwned = await isTokenOwnedByWallet(mint.tokenId, userData.walletAddress);
                            return isOwned ? mint.tokenId.toString() : null;
                        } catch (error) {
                            console.error(`Failed to verify ownership of token ${mint.tokenId}:`, error.message);
                            return null;
                        }
                    }
                    return null;
                });

                const verificationResults = await Promise.all(verificationPromises);
                currentlyOwnedTokenIds = verificationResults.filter(tokenId => tokenId !== null);
                console.log(`Verified ${currentlyOwnedTokenIds.length} owned tokens individually:`, currentlyOwnedTokenIds);
            }

            if (currentlyOwnedTokenIds.length === 0) {
                console.warn('Could not verify any owned tokens - user may not own any NFTs currently');
            }
        }

        // 3. Set up the zip archive
        res.set({
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="hope_archive_${userData.name?.replace(/[^a-z0-9]/gi, '_') || 'user'}.zip"`,
            'Cache-Control': 'no-cache'
        });

        const archive = archiver('zip', { zlib: { level: 9 } });

        archive.on('error', (err) => {
            console.error('Archive error:', err);
            if (!res.headersSent) {
                res.status(500).send('Error creating archive');
            }
        });

        archive.pipe(res);

        // 4. Get certificates - only for currently owned token IDs
        let addedCount = 0;

        if (currentlyOwnedTokenIds.length > 0) {
            // Try to get certificates from certificates collection first
            try {
                // Split into chunks of 10 for Firestore 'in' query limit
                const chunks = [];
                for (let i = 0; i < currentlyOwnedTokenIds.length; i += 10) {
                    chunks.push(currentlyOwnedTokenIds.slice(i, i + 10));
                }

                const allCertificates = [];
                for (const chunk of chunks) {
                    const certificatesSnapshot = await db.collection('certificates')
                        .where('tokenId', 'in', chunk)
                        .get();

                    certificatesSnapshot.docs.forEach(doc => {
                        allCertificates.push(doc.data());
                    });
                }

                console.log(`Found ${allCertificates.length} certificates in certificates collection`);

                // Add certificates from certificates collection
                const downloadPromises = allCertificates.map(async (certData) => {
                    try {
                        if (certData.ipfsUrl) {
                            console.log(`Downloading certificate for token ${certData.tokenId} from IPFS`);
                            const response = await axios.get(certData.ipfsUrl, {
                                responseType: 'arraybuffer',
                                timeout: 30000,
                                maxRedirects: 5
                            });
                            archive.append(Buffer.from(response.data), {
                                name: `Certificates/ownership_certificate_token_${certData.tokenId}.png`
                            });
                            addedCount++;
                            console.log(`Successfully added certificate for token ${certData.tokenId}`);
                        }
                    } catch (error) {
                        console.error(`Failed to download certificate for token ${certData.tokenId}:`, error.message);
                    }
                });

                await Promise.all(downloadPromises);
            } catch (error) {
                console.error('Error with certificates collection query:', error.message);
            }

            // If no certificates found in certificates collection, try user mints data
            if (addedCount === 0 && userData.mints) {
                console.log('No certificates found in certificates collection, trying user mints data');

                const mintPromises = userData.mints
                    .filter(mint => currentlyOwnedTokenIds.includes(mint.tokenId.toString()))
                    .map(async (mint) => {
                        try {
                            if (mint.certificateIpfsUrl) {
                                console.log(`Downloading certificate for token ${mint.tokenId} from user mint data`);
                                const response = await axios.get(mint.certificateIpfsUrl, {
                                    responseType: 'arraybuffer',
                                    timeout: 30000,
                                    maxRedirects: 5
                                });
                                archive.append(Buffer.from(response.data), {
                                    name: `Certificates/ownership_certificate_token_${mint.tokenId}.png`
                                });
                                addedCount++;
                            } else if (mint.ownershipCardUrl) {
                                // Try local file
                                const localPath = path.join(__dirname, mint.ownershipCardUrl.replace('/images/', 'generated_images/'));
                                if (fs.existsSync(localPath)) {
                                    console.log(`Adding local certificate for token ${mint.tokenId}`);
                                    archive.file(localPath, {
                                        name: `Certificates/ownership_certificate_token_${mint.tokenId}.png`
                                    });
                                    addedCount++;
                                }
                            }
                        } catch (error) {
                            console.error(`Failed to download certificate for token ${mint.tokenId} from mint data:`, error.message);
                        }
                    });

                await Promise.all(mintPromises);
            }
        }

        // 5. Add Autograph and Song mp3 folder if exists
        const signAndSongPath = path.join(__dirname, 'Autograph and Song mp3');
        if (fs.existsSync(signAndSongPath)) {
            console.log('Adding Autograph and Song mp3 folder');
            archive.directory(signAndSongPath, 'Autograph and Song mp3');
        } else {
            console.warn('Autograph and Song mp3 folder not found');
            archive.append('Additional content folder not found. Please contact support if you believe this content should be available.', {
                name: 'Autograph and Song mp3/README.txt'
            });
        }

        // 6. Add a comprehensive README file with user info
        const readmeContent = `MUSE Archive for ${userData.name}
========================================

User Information:
- Name: ${userData.name}
- Email: ${userData.email || 'N/A'}
- Wallet Address: ${userData.walletAddress || 'N/A'}

Ownership Information:
- Total NFTs Currently Owned: ${currentlyOwnedTokenIds.length}
- Token IDs Currently Owned: ${currentlyOwnedTokenIds.length > 0 ? currentlyOwnedTokenIds.join(', ') : 'None'}
- Certificates Included: ${addedCount}
- Data Source: ${usedBlockchainData ? 'Blockchain (Live)' : 'Database with Individual Verification'}

Archive Details:
- Generated: ${new Date().toISOString()}
- Archive Version: 2.0

Contents:
1. /Certificates/ - Your ownership certificates for currently owned NFTs
2. /Autograph and Song mp3/ - Additional project content and assets

Notes:
- This archive only includes certificates for NFTs you currently own
- If you previously owned NFTs that were transferred/sold, those certificates are not included
- If you believe there's an error with your certificates, please contact support

Support: Contact the MUSE team for any issues with your archive
`;
        archive.append(readmeContent, { name: 'README.txt' });

        console.log(`Added ${addedCount} certificates to archive for ${currentlyOwnedTokenIds.length} owned tokens`);

        // Add status information
        if (currentlyOwnedTokenIds.length === 0) {
            archive.append(`No NFTs Currently Owned

This wallet address does not currently own any MUSE NFTs.
This could mean:
1. No NFTs were ever minted to this address
2. NFTs were transferred/sold to other addresses
3. There may be a technical issue

If you believe this is incorrect, please contact support with:
- Your wallet address: ${userData.walletAddress}
- Your email: ${userData.email}
- Transaction hashes of your mints

Generated: ${new Date().toISOString()}`, {
                name: 'Certificates/NO_NFTS_CURRENTLY_OWNED.txt'
            });
        } else if (addedCount === 0) {
            archive.append(`Certificates Not Found

You currently own ${currentlyOwnedTokenIds.length} NFT(s) with token ID(s): ${currentlyOwnedTokenIds.join(', ')}

However, no certificate files could be retrieved. This may be due to:
1. IPFS connectivity issues
2. Certificate files not being properly stored
3. Technical issues with certificate generation

Please contact support with this information:
- Your wallet address: ${userData.walletAddress}
- Your email: ${userData.email}
- Token IDs: ${currentlyOwnedTokenIds.join(', ')}

Generated: ${new Date().toISOString()}`, {
                name: 'Certificates/CERTIFICATES_NOT_FOUND.txt'
            });
        }

        archive.finalize();

    } catch (error) {
        console.error('Error creating archive:', error);
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Failed to create archive',
                details: error.message
            });
        }
    }
});


app.get('/api/token/:tokenId', cors(corsOptions), async (req, res) => {
    try {
        const tokenId = req.params.tokenId;

        // Get token URI
        const tokenURI = await nftContract.methods.tokenURI(tokenId).call();

        // Get owner address
        const owner = await nftContract.methods.ownerOf(tokenId).call();

        res.json({
            tokenId,
            tokenURI,
            owner,
            contractAddress
        });
    } catch (error) {
        console.error('Error fetching token metadata:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add a new endpoint to get wallet info
app.get('/api/wallet/:walletAddress', cors(corsOptions), async (req, res) => {
    try {

        const walletAddress = req.params.walletAddress;
        console.log("walletAddress in get method : " + walletAddress)


        let tokenIds = [];
        let method = 'unknown';

        try {
            // Try the custom function first
            tokenIds = await nftContract.methods.getWalletTokenIds(walletAddress).call();
            console.log("tokenIds in get method : " + tokenIds)

            tokenIds = tokenIds.map(id => id.toString());
            method = 'getWalletTokenIds';
        } catch (error) {
            console.log('getWalletTokenIds failed, falling back to balanceOf + tokenOfOwnerByIndex');

            try {
                const balance = await nftContract.methods.balanceOf(walletAddress).call();
                console.log("balance in get method : " + balance)

                const tokenCount = Number(balance);
                tokenIds = [];

                for (let i = 0; i < tokenCount; i++) {
                    try {
                        const tokenId = await nftContract.methods.tokenOfOwnerByIndex(walletAddress, i).call();
                        tokenIds.push(tokenId.toString());
                    } catch (innerError) {
                        console.error(`Error getting token at index ${i}:`, innerError.message);
                        // Continue with next index
                        continue;
                    }
                }
                method = 'balanceOf + tokenOfOwnerByIndex';
            } catch (balanceError) {
                console.error('All methods failed:', balanceError.message);
                return res.status(500).json({
                    error: 'Unable to fetch wallet information',
                    details: 'All blockchain query methods failed. This may be due to ABI mismatch or network issues.',
                    suggestion: 'Please verify the contract ABI and network connection.'
                });
            }
        }

        res.json({
            walletAddress,
            balance: tokenIds.length,
            tokenIds,
            method: method
        });
    } catch (error) {
        console.error('Error fetching wallet info:', error);
        res.status(500).json({
            error: 'Failed to fetch wallet info',
            details: error.message
        });
    }
});


// You'll need to add this helper function to check current ownership on-chain
async function getCurrentlyOwnedTokenIds(walletAddress) {
    try {
        if (!walletAddress) {
            throw new Error('Wallet address is required');
        }

        console.log(`Checking ownership for wallet: ${walletAddress}`);

        // Method 1: Try the custom getWalletTokenIds function if it exists
        try {
            const tokenIds = await nftContract.methods.getWalletTokenIds(walletAddress).call();
            console.log('Successfully used getWalletTokenIds method');
            return tokenIds.map(id => id.toString());
        } catch (customError) {
            console.log('getWalletTokenIds method failed, trying standard ERC721 methods');
        }

        // Method 2: Use standard ERC721 balanceOf + tokenOfOwnerByIndex
        try {
            const balance = await nftContract.methods.balanceOf(walletAddress).call();
            const tokenCount = Number(balance);
            console.log(`Wallet balance: ${tokenCount}`);

            if (tokenCount === 0) {
                return [];
            }

            const ownedTokenIds = [];
            for (let i = 0; i < tokenCount; i++) {
                try {
                    const tokenId = await nftContract.methods.tokenOfOwnerByIndex(walletAddress, i).call();
                    ownedTokenIds.push(tokenId.toString());
                } catch (indexError) {
                    console.error(`Error getting token at index ${i}:`, indexError.message);
                    // Continue with next index instead of breaking
                    continue;
                }
            }
            return ownedTokenIds;
        } catch (balanceError) {
            console.log('balanceOf method failed, trying individual ownership checks');
        }

        // Method 3: If user has mint history, check individual token ownership
        // This will be handled in the main function by passing user mint data
        throw new Error('All blockchain methods failed - will use Firestore data with individual ownership verification');

    } catch (error) {
        console.error('Error in getCurrentlyOwnedTokenIds:', error.message);
        throw error;
    }
}

async function isTokenOwnedByWallet(tokenId, walletAddress) {
    try {
        const owner = await nftContract.methods.ownerOf(tokenId).call();
        return owner.toLowerCase() === walletAddress.toLowerCase();
    } catch (error) {
        console.error(`Error checking ownership of token ${tokenId}:`, error.message);
        return false; // Assume not owned if we can't verify
    }
}

app.get('/api/certificates/:tokenId', cors(corsOptions), async (req, res) => {
    try {
        const tokenId = req.params.tokenId;
        const certDoc = await db.collection('certificates').doc(tokenId).get();

        if (!certDoc.exists) {
            return res.status(404).json({ error: 'Certificate not found' });
        }

        res.json(certDoc.data());
    } catch (error) {
        console.error('Error fetching certificate:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
