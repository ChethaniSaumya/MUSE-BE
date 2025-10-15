require('dotenv').config();
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
const web3 = new Web3(new Web3.providers.HttpProvider('https://methodical-intensive-reel.matic.quiknode.pro/f053d766df9716bed741c91f5c0815633a15ab94/'));
const nodemailer = require('nodemailer');
const paypal = require('@paypal/checkout-server-sdk');
const payoutsSDK = require('@paypal/payouts-sdk')
const rateLimit = require('express-rate-limit');
const admin = require('firebase-admin');
const sharp = require('sharp');

const Environment = process.env.NODE_ENV === 'production'
	? paypal.core.LiveEnvironment
	: paypal.core.SandboxEnvironment;

const paypalClient = new paypal.core.PayPalHttpClient(
	new Environment(
		process.env.PAYPAL_CLIENT_ID,
		process.env.PAYPAL_CLIENT_SECRET
	)
);

/*
const adminLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 10, // Max 10 requests per 15 minutes
	message: { error: 'Too many admin requests. Please try again later.' },
	standardHeaders: true,
	legacyHeaders: false
});*/

let emailTransporter;
try {
	/*emailTransporter = nodemailer.createTransport({  // Changed from createTransporter to createTransport
		service: 'gmail', // or 'SendGrid', 'Mailgun', etc.
		auth: {
			user: process.env.EMAIL_USER, // Your email
			pass: process.env.EMAIL_PASS  // Your email password or app password
		}
	});*/

	emailTransporter = nodemailer.createTransport({
		host: 'smtpout.secureserver.net', // GoDaddy SMTP server
		port: 465, // or 587 for TLS
		secure: true, // true for 465, false for 587
		auth: {
			user: process.env.EMAIL_USER, // Your full GoDaddy email address
			pass: process.env.EMAIL_PASS  // Your GoDaddy email password
		}
	});

} catch (error) {
	console.error('❌ Failed to create email transporter:', error);
	process.exit(1);
}

const compressImage = async (imageBuffer, maxWidth = 1200, quality = 80) => {
	try {
		console.log('🖼️ Compressing image...');

		const image = sharp(imageBuffer);
		const metadata = await image.metadata();

		let width = metadata.width;
		let height = metadata.height;

		// Resize if necessary
		if (width > maxWidth) {
			height = Math.round((height / width) * maxWidth);
			width = maxWidth;
		}

		// Compress image
		const compressedBuffer = await image
			.resize(width, height, {
				fit: 'inside',
				withoutEnlargement: true
			})
			.jpeg({
				quality,
				progressive: true,
				mozjpeg: true
			})
			.toBuffer();

		const originalSize = (imageBuffer.length / 1024 / 1024).toFixed(2);
		const compressedSize = (compressedBuffer.length / 1024 / 1024).toFixed(2);

		console.log(`✅ Image compressed: ${originalSize}MB → ${compressedSize}MB`);

		return compressedBuffer;
	} catch (error) {
		console.error('❌ Image compression failed:', error);
		throw error;
	}
};

const contractABI = [
	{
		"inputs": [
			{
				"internalType": "address[]",
				"name": "addresses",
				"type": "address[]"
			}
		],
		"name": "addToWhitelist",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "receiver",
				"type": "address"
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
			},
			{
				"internalType": "uint256",
				"name": "tokenId",
				"type": "uint256"
			}
		],
		"name": "airdrop",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
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
				"internalType": "address[]",
				"name": "receivers",
				"type": "address[]"
			},
			{
				"internalType": "string[]",
				"name": "names",
				"type": "string[]"
			},
			{
				"internalType": "string[]",
				"name": "emails",
				"type": "string[]"
			},
			{
				"internalType": "uint256[]",
				"name": "tokenIds",
				"type": "uint256[]"
			}
		],
		"name": "bulkAirdrop",
		"outputs": [],
		"stateMutability": "nonpayable",
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
				"name": "_couponCode",
				"type": "string"
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
		"name": "couponMint",
		"outputs": [],
		"stateMutability": "payable",
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
		"inputs": [
			{
				"internalType": "address[]",
				"name": "addresses",
				"type": "address[]"
			}
		],
		"name": "removeFromWhitelist",
		"outputs": [],
		"stateMutability": "nonpayable",
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
				"internalType": "bool",
				"name": "_coupon_mint_status",
				"type": "bool"
			}
		],
		"name": "setCoupon_mint_status",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_couponCode",
				"type": "string"
			}
		],
		"name": "setCouponCode",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_couponMintPrice",
				"type": "uint256"
			}
		],
		"name": "setCouponMintPrice",
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
				"name": "_max_coupon_per_wallet",
				"type": "uint256"
			}
		],
		"name": "setMax_coupon_per_wallet",
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
				"name": "_max_whitelist_per_wallet",
				"type": "uint256"
			}
		],
		"name": "setMax_whitelist_per_wallet",
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
				"internalType": "bool",
				"name": "_whitelist_mint_status",
				"type": "bool"
			}
		],
		"name": "setWhitelist_mint_status",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_whitelistAdditionalPrice",
				"type": "uint256"
			}
		],
		"name": "setWhitelistAdditionalPrice",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_whitelistBasePrice",
				"type": "uint256"
			}
		],
		"name": "setWhitelistBasePrice",
		"outputs": [],
		"stateMutability": "nonpayable",
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
		"name": "whitelistMint",
		"outputs": [],
		"stateMutability": "payable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "withdraw",
		"outputs": [],
		"stateMutability": "payable",
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
		"inputs": [],
		"name": "coupon_mint_status",
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
		"name": "couponMintPrice",
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
			}
		],
		"name": "couponUserMinted",
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
		"inputs": [
			{
				"internalType": "string",
				"name": "_couponCode",
				"type": "string"
			}
		],
		"name": "isValidCoupon",
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
				"internalType": "address",
				"name": "user",
				"type": "address"
			}
		],
		"name": "isWhitelisted",
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
		"name": "max_coupon_per_wallet",
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
		"name": "max_whitelist_per_wallet",
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
		"name": "whitelist_mint_status",
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
		"name": "whitelistAdditionalPrice",
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
		"name": "whitelistBasePrice",
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
			}
		],
		"name": "whitelisted",
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
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "whitelistUserMinted",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
];

const contractAddress = '0xcD9B1F056f80a6084B614C50dd345778633d13A4'; // Replace with your contract address

// Create contract instance
const nftContract = new web3.eth.Contract(contractABI, contractAddress);

// Middleware
app.use(cookieParser());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use((req, res, next) => {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
	res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
	next();
});


// Serve static files (for generated images)
app.use('/images', express.static(path.join(__dirname, 'generated_images')));

var corsOptions = {
	origin: ['https://adminpanel.musecoinx.com', 'https://dgfg-six.vercel.app/', 'https://www.musecoinx.com/', 'http://localhost:3000', 'https://hopecoinkk.musecoinx.com', 'http://localhost:8080', 'http://localhost:8081', 'http://localhost:3002'],
	optionsSuccessStatus: 200,
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
	allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
	exposedHeaders: ['Content-Type', 'Content-Disposition', 'Content-Length'],
	credentials: true
};


// Pinata configuration
const PINATA_JWT = process.env.PINATA_JWT; // Add your Pinata JWT token to environment variables
const PINATA_API_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';




// Initialize Firebase Admin only if not already initialized
if (!admin.apps.length) {
	try {
		admin.initializeApp({
			credential: admin.credential.applicationDefault(),
			databaseURL: process.env.FIREBASE_DATABASE_URL
		});
		console.log('Firebase Admin initialized successfully');
	} catch (error) {
		console.error('Firebase Admin initialization error:', error);
	}
}

// Ensure directories exist
const ensureDirectoryExists = (dirPath) => {
	if (!fs.existsSync(dirPath)) {
		fs.mkdirSync(dirPath, { recursive: true });
	}
};

// Initialize directories
ensureDirectoryExists(path.join(__dirname, 'generated_images'));
ensureDirectoryExists(path.join(__dirname, 'assets'));


const createMintSuccessEmail = (userName, tokenId, certificateUrl, isAirdrop = false) => {
	const subject = isAirdrop ?
		`🎁 Your Hope KK NFT has been airdropped!` :
		`🎉 Your Hope KK NFT has been minted successfully!`;

	const mintingText = isAirdrop ?
		'has been airdropped to your wallet' :
		'has been successfully minted';

	return {
		subject: subject,
		html: `
		<!DOCTYPE html>
		<html>
		<head>
			<style>
				body {
					font-family: 'Arial', sans-serif;
					line-height: 1.6;
					color: #333;
					max-width: 600px;
					margin: 0 auto;
					padding: 20px;
					background-color: #f4f4f4;
				}
				.email-container {
					background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
					border-radius: 15px;
					padding: 30px;
					box-shadow: 0 10px 25px rgba(0,0,0,0.1);
				}
				.header {
					text-align: center;
					color: white;
					margin-bottom: 30px;
				}
				.header h1 {
					margin: 0;
					font-size: 28px;
					text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
				}
				.content {
					background: white;
					padding: 30px;
					border-radius: 10px;
					margin: 20px 0;
					box-shadow: 0 5px 15px rgba(0,0,0,0.1);
				}
				.nft-info {
					background: #f8f9fa;
					padding: 20px;
					border-radius: 8px;
					margin: 20px 0;
					border-left: 4px solid #667eea;
				}
				.download-button {
					display: inline-block;
					background: linear-gradient(45deg, #667eea, #764ba2);
					color: white;
					padding: 15px 30px;
					text-decoration: none;
					border-radius: 25px;
					font-weight: bold;
					text-align: center;
					margin: 20px 0;
					box-shadow: 0 4px 15px rgba(0,0,0,0.2);
					transition: all 0.3s ease;
				}
				.download-button:hover {
					transform: translateY(-2px);
					box-shadow: 0 6px 20px rgba(0,0,0,0.3);
				}
				.footer {
					text-align: center;
					color: #666;
					font-size: 14px;
					margin-top: 30px;
					padding-top: 20px;
					border-top: 1px solid #eee;
				}
				.tribute-section {
					background: #fff3cd;
					border: 1px solid #ffeaa7;
					border-radius: 8px;
					padding: 20px;
					margin: 20px 0;
					text-align: center;
				}
				.social-links {
					text-align: center;
					margin: 20px 0;
				}
				.social-links a {
					display: inline-block;
					margin: 0 10px;
					color: #667eea;
					text-decoration: none;
				}
				.important-note {
					background: #d1ecf1;
					border: 1px solid #bee5eb;
					border-radius: 8px;
					padding: 15px;
					margin: 20px 0;
				}
			</style>
		</head>
		<body>
			<div class="email-container">
				<div class="header">
					<h1>🎵 Hope KK NFT</h1>
					<p>Tribute to the Legendary Singer</p>
				</div>
				
				<div class="content">
					<h2>Hello ${userName}! 👋</h2>
					
					<p>Congratulations! Your Hope KK commemorative NFT ${mintingText}. You are now part of an exclusive community honoring the musical legacy of the legendary singer KK.</p>
					
					<div class="nft-info">
						<h3>📜 Your NFT Details:</h3>
						<p><strong>Token ID:</strong> #${tokenId?.toString().padStart(5, '0') || 'TBD'}</p>
						<p><strong>Collection:</strong> Hope KK Commemorative NFTs</p>
						<p><strong>Status:</strong> Successfully ${isAirdrop ? 'Airdropped' : 'Minted'}</p>
					</div>
					
					<div class="tribute-section">
						<h3>🎤 About This Tribute</h3>
						<p>This NFT celebrates KK's extraordinary musical journey and his timeless contribution to the world of music. Through "Humein Asha Hai," we honor not just his voice, but his vision of hope and resilience.</p>
					</div>
					
					${certificateUrl ? `
					<div style="text-align: center;">
						<h3>🏆 Download Your Certificate</h3>
						<p>Your personalized ownership certificate is ready!</p>
						<a href="https://hopecoinkk.musecoinx.com/my-dashboard" class="download-button" style="color: white;">My Dashboard</a>
					</div>
					` : ''}
					
					<div class="important-note">
						<h4>📱 What's Next?</h4>
						<ul style="text-align: left;">
							<li>Your NFT is now in your wallet</li>
							<li>You can view it on OpenSea and other NFT marketplaces</li>
							<li>Keep your certificate as proof of ownership</li>
							<li>Join our community to stay updated on future releases</li>
						</ul>
					</div>
					
					<div class="social-links">
						<p><strong>Connect with us:</strong></p>
						<a href="https://www.musecoinx.com">🌐 Website</a>
						<a href="mailto:contact@musecoinx.com">📧 Support</a>
					</div>
				</div>
				
				<div class="footer">
					<p style="font-size: 15px; color: white;">Thank you for being part of this tribute to KK's legacy.</p>
					<p style="font-size: 15px; color: white;">© ${new Date().getFullYear()} MuseCoinX. A PhyDigi Limited Company. All rights reserved</p>
					<p style="font-size: 12px; color: #999;">
						This is an automated email. Please do not reply to this address.
					</p>
				</div>
			</div>
		</body>
		</html>
		`
	};
};

const sendMintSuccessEmail = async (userEmail, userName, tokenId, certificateUrl, isAirdrop = false) => {
	try {
		const emailContent = createMintSuccessEmail(userName, tokenId, certificateUrl, isAirdrop);

		const mailOptions = {
			from: `"MuseCoinX - Hope KK NFTs" <${process.env.EMAIL_USER}>`,
			to: userEmail,
			subject: emailContent.subject,
			html: emailContent.html
		};

		const result = await emailTransporter.sendMail(mailOptions);
		console.log('Email sent successfully:', result.messageId);
		return { success: true, messageId: result.messageId };
	} catch (error) {
		console.error('Error sending email:', error);
		return { success: false, error: error.message };
	}
};

const uploadToIPFS = async (filePath, fileName, maxRetries = 5) => {
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			console.log(`📤 Uploading attempt ${attempt} to IPFS...`);

			if (!PINATA_JWT) {
				throw new Error('PINATA_JWT environment variable is not set');
			}

			const formData = new FormData();
			const fileStream = fs.createReadStream(filePath);

			formData.append('file', fileStream);

			// Add metadata
			const metadata = JSON.stringify({
				name: fileName,
				keyvalues: {
					type: 'artist-project-image',
					uploaded: new Date().toISOString()
				}
			});
			formData.append('pinataMetadata', metadata);

			// Add options
			const options = JSON.stringify({
				cidVersion: 1,
			});
			formData.append('pinataOptions', options);

			// Create a custom axios instance with longer timeout
			const axiosInstance = axios.create({
				timeout: 30000, // 30 seconds timeout
				timeoutErrorMessage: 'IPFS upload timeout'
			});

			const response = await axiosInstance.post(PINATA_API_URL, formData, {
				maxBodyLength: Infinity,
				maxContentLength: Infinity,
				headers: {
					'Content-Type': `multipart/form-data; boundary=${formData._boundary}`,
					'Authorization': `Bearer ${PINATA_JWT}`
				}
			});

			console.log('✅ File uploaded to IPFS:', response.data);

			// Return the IPFS URL
			return {
				ipfsHash: response.data.IpfsHash,
				ipfsUrl: `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`,
				pinataUrl: `https://pinata.cloud/ipfs/${response.data.IpfsHash}`
			};

		} catch (error) {
			console.error(`❌ IPFS upload error (attempt ${attempt}):`, error.message);

			if (attempt === maxRetries) {
				throw new Error(`IPFS upload failed after ${maxRetries} attempts: ${error.message}`);
			}

			// Exponential backoff for retries
			const delayMs = Math.pow(2, attempt) * 1000;
			console.log(`⏳ Retrying in ${delayMs / 1000} seconds...`);
			await new Promise(resolve => setTimeout(resolve, delayMs));
		}
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

const authenticateAdmin = async (req, res, next) => {
	try {
		// 1. Extract admin key from headers or query
		const adminKey = req.headers['x-admin-key'] || req.query.adminKey;
		const expectedKey = process.env.ADMIN_API_KEY || process.env.REACT_APP_ADMIN_KEY;

		// 2. Key validation
		if (!adminKey || adminKey !== expectedKey) {
			// Log unauthorized attempt
			await db.collection('security_log').add({
				event: 'unauthorized_admin_attempt',
				ip: req.ip,
				userAgent: req.get('User-Agent'),
				timestamp: admin.firestore.FieldValue.serverTimestamp(),
				endpoint: req.path,
				attemptedKey: adminKey ? 'REDACTED' : 'MISSING'
			});

			return res.status(401).json({
				error: 'Unauthorized: Invalid admin key',
				code: 'ADMIN_AUTH_FAILED'
			});
		}

		// 3. Log successful admin access
		await db.collection('admin_access_log').add({
			ip: req.ip,
			endpoint: req.path,
			method: req.method,
			timestamp: admin.firestore.FieldValue.serverTimestamp(),
			userAgent: req.get('User-Agent')
		});

		// 4. Add admin context to request
		req.adminContext = {
			authenticatedAt: new Date().toISOString(),
			accessMethod: adminKey === req.query.adminKey ? 'query' : 'header',
			adminId: 'admin'
		};

		next();

	} catch (error) {
		console.error('Admin authentication system error:', error);
		res.status(500).json({
			error: 'Authentication system error',
			code: 'AUTH_SYSTEM_FAILURE'
		});
	}
};

// Add this endpoint around line 1200 (near other payout endpoints)
app.get('/api/payout-limits/current', cors(corsOptions), async (req, res) => {
	try {
		const limitsDoc = await db.collection('admin_settings').doc('payout_limits').get();

		if (!limitsDoc.exists) {
			return res.json({
				totalLimit: 0,
				isActive: false
			});
		}

		const data = limitsDoc.data();
		const remainingLimit = Math.max(0, data.totalLimit - (data.usedAmount || 0));

		res.json({
			totalLimit: data.totalLimit || 0,
			remainingLimit: remainingLimit,
			isActive: remainingLimit > 0
		});
	} catch (error) {
		console.error('Error fetching current payout limits:', error);
		res.status(500).json({ error: 'Failed to fetch payout limits' });
	}
});

// ADD: Public endpoint to show remaining limits (without admin auth)
app.get('/api/payout-limits/public', cors(corsOptions), async (req, res) => {
	try {
		const limitsDoc = await db.collection('admin_settings').doc('payout_limits').get();

		if (!limitsDoc.exists) {
			return res.json({
				isActive: false,
				remainingLimit: 0
			});
		}

		const data = limitsDoc.data();
		const remainingLimit = Math.max(0, data.totalLimit - (data.usedAmount || 0));

		// Only return public info - no sensitive data
		res.json({
			isActive: remainingLimit > 0,
			remainingLimit: remainingLimit,
			minimumPayout: 1.00
		});
	} catch (error) {
		console.error('Error fetching public limits:', error);
		res.status(500).json({ error: 'Failed to fetch limits' });
	}
});

// POST: Set/Update payout limits
app.post('/api/authenticateAdmin', cors(corsOptions), async (req, res) => {
	try {
		const { totalLimit, resetPeriod = 'monthly' } = req.body;

		// Validation
		if (!totalLimit || totalLimit <= 0) {
			return res.status(400).json({ error: 'Total limit must be greater than 0' });
		}

		if (totalLimit > 100000) { // Reasonable max limit
			return res.status(400).json({ error: 'Total limit cannot exceed $100,000' });
		}

		const db = admin.firestore();
		const now = new Date();

		await db.collection('admin_settings').doc('payout_limits').set({
			totalLimit: parseFloat(totalLimit),
			usedAmount: 0, // Reset used amount when setting new limit
			lastReset: now,
			resetPeriod: resetPeriod,
			updatedAt: now,
			updatedBy: 'admin' // In production, use actual admin ID
		});

		// Log the change for audit trail
		await db.collection('admin_audit_log').add({
			action: 'payout_limit_updated',
			oldLimit: null, // You might want to fetch the old value first
			newLimit: totalLimit,
			timestamp: now,
			adminId: 'admin' // In production, use actual admin ID
		});

		res.json({
			success: true,
			message: 'Payout limit updated successfully',
			totalLimit: parseFloat(totalLimit),
			remainingLimit: parseFloat(totalLimit)
		});
	} catch (error) {
		console.error('Error setting payout limits:', error);
		res.status(500).json({ error: 'Failed to set payout limits' });
	}
});

// POST: Reset payout limits (manual reset)
app.post('/api/authenticateAdmin_reset', cors(corsOptions), async (req, res) => {
	try {
		const db = admin.firestore();
		const limitsDoc = await db.collection('admin_settings').doc('payout_limits').get();

		if (!limitsDoc.exists) {
			return res.status(404).json({ error: 'Payout limits not configured' });
		}

		const data = limitsDoc.data();
		const now = new Date();

		await db.collection('admin_settings').doc('payout_limits').update({
			usedAmount: 0,
			lastReset: now,
			updatedAt: now
		});

		// Log the reset
		await db.collection('admin_audit_log').add({
			action: 'payout_limit_reset',
			previousUsedAmount: data.usedAmount,
			timestamp: now,
			adminId: 'admin'
		});

		res.json({
			success: true,
			message: 'Payout limits reset successfully',
			remainingLimit: data.totalLimit
		});
	} catch (error) {
		console.error('Error resetting payout limits:', error);
		res.status(500).json({ error: 'Failed to reset payout limits' });
	}
});


// Apply rate limiting to admin endpoints
//app.use('/api/admin', adminLimiter);

// Public endpoint to show remaining limits
app.get('/api/payout-limits/public', cors(corsOptions), async (req, res) => {
	try {
		const limitsDoc = await db.collection('admin_settings').doc('payout_limits').get();

		if (!limitsDoc.exists) {
			return res.json({
				isActive: false,
				remainingLimit: 0
			});
		}

		const data = limitsDoc.data();
		const remainingLimit = Math.max(0, data.totalLimit - (data.usedAmount || 0));

		res.json({
			isActive: remainingLimit > 0,
			remainingLimit: remainingLimit,
			minimumPayout: 1.00
		});
	} catch (error) {
		console.error('Error fetching public limits:', error);
		res.status(500).json({ error: 'Failed to fetch limits' });
	}
});

// Reset payout limits
app.post('/api/admin/payout-limits/reset', cors(corsOptions), authenticateAdmin, async (req, res) => {
	try {
		const limitsDoc = await db.collection('admin_settings').doc('payout_limits').get();

		if (!limitsDoc.exists) {
			return res.status(404).json({ error: 'Payout limits not configured' });
		}

		const data = limitsDoc.data();
		const now = new Date();

		await db.collection('admin_settings').doc('payout_limits').update({
			usedAmount: 0,
			lastReset: now,
			updatedAt: now
		});

		// Audit log
		await db.collection('admin_audit_log').add({
			action: 'payout_limit_reset',
			previousUsedAmount: data.usedAmount,
			timestamp: now,
			adminId: req.adminContext?.adminId || 'admin', // Add safe fallback
			ip: req.ip || 'unknown'
		});

		res.json({
			success: true,
			message: 'Payout limits reset successfully',
			remainingLimit: data.totalLimit
		});
	} catch (error) {
		console.error('Error resetting payout limits:', error);
		res.status(500).json({ error: 'Failed to reset payout limits' });
	}
});

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
			privacyPolicyAccepted,
			subscribe,
			isAirdrop
		} = req.body;

		console.log('Received user data:', { name, email, walletAddress, tokenId, isAirdrop });

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
		let certificateExists = false;

		// Check if certificate already exists for this token ID
		if (tokenId) {
			try {
				const certDoc = await db.collection('certificates').doc(tokenId.toString()).get();
				if (certDoc.exists) {
					certificateExists = true;
					const certData = certDoc.data();
					ipfsData = {
						ipfsHash: certData.ipfsHash,
						ipfsUrl: certData.ipfsUrl,
						pinataUrl: certData.pinataUrl
					};
					console.log(`Certificate already exists for token ${tokenId}: ${certData.ipfsUrl}`);
				}
			} catch (certError) {
				console.error('Error checking existing certificate:', certError);
			}
		}

		// Generate personalized ownership card if this is a new mint and certificate doesn't exist
		if (nftMinted && transactionHash && !certificateExists) {
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
						ipfsUrl: ipfsData.ipfsUrl,
						ipfsHash: ipfsData.ipfsHash,
						pinataUrl: ipfsData.pinataUrl,
						createdAt: new Date().toISOString(),
						isAirdrop: isAirdrop || false
					});
				} catch (ipfsError) {
					console.error('IPFS upload failed, using local storage:', ipfsError);
					// Store with just local URL if IPFS fails
					await db.collection('certificates').doc(tokenId.toString()).set({
						tokenId: tokenId.toString(),
						localImageUrl: localImageUrl,
						createdAt: new Date().toISOString(),
						isAirdrop: isAirdrop || false
					});
				}
			} catch (imageError) {
				console.error('Failed to generate ownership card:', imageError);
			}
		}

		// Variable to track email sending result
		let emailSent = false;

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
					privacyPolicyAccepted: privacyPolicyAccepted || false,
					privacyPolicyAcceptedAt: privacyPolicyAccepted ? new Date().toISOString() : null,
					ageConfirmed: ageConfirmed || false,
					ageConfirmedAt: ageConfirmed ? new Date().toISOString() : null,
					subscribeNewsletter: subscribe || false,
					subscribeNewsletterAt: subscribe ? new Date().toISOString() : null,
					isAirdrop: isAirdrop || false,
					certificateAlreadyExisted: certificateExists
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
					subscribeNewsletter: subscribe || existingData.subscribeNewsletter || false,
					subscribeNewsletterAt: subscribe ? new Date().toISOString() : (existingData.subscribeNewsletterAt || null)
				};

				console.log('Updating user with airdrop data:', { tokenId, isAirdrop, certificateExists });

				await userRef.update(updateData);

				// Send email for existing user with new mint
				if (name && email) {
					try {
						const emailResult = await sendMintSuccessEmail(
							email,
							name,
							tokenId,
							ipfsData?.ipfsUrl || localImageUrl,
							isAirdrop
						);

						emailSent = emailResult.success;

						if (emailResult.success) {
							console.log(`✅ Mint success email sent to ${email}`);
						} else {
							console.error(`❌ Failed to send email to ${email}:`, emailResult.error);
						}
					} catch (emailError) {
						console.error('Error in email sending process:', emailError);
						emailSent = false;
					}
				}

				return res.status(200).json({
					success: true,
					message: certificateExists ?
						'User data updated with existing certificate' :
						'User data updated with new mint information',
					userId: docId,
					tokenId: tokenId,
					certificateIpfsUrl: ipfsData?.ipfsUrl,
					ownershipCardUrl: localImageUrl,
					ipfsHash: ipfsData?.ipfsHash,
					totalMinted: currentMints.length,
					subscribeNewsletter: subscribe || false,
					isAirdrop: isAirdrop || false,
					certificateAlreadyExisted: certificateExists,
					emailSent: emailSent
				});
			} else {
				return res.status(200).json({
					success: true,
					message: 'User already exists',
					userId: docId,
					userData: existingData,
					emailSent: false
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
			privacyPolicyAccepted: privacyPolicyAccepted || false,
			privacyPolicyAcceptedAt: privacyPolicyAccepted ? new Date().toISOString() : null,
			ageConfirmed: ageConfirmed || false,
			ageConfirmedAt: ageConfirmed ? new Date().toISOString() : null,
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
				privacyPolicyAccepted: privacyPolicyAccepted || false,
				privacyPolicyAcceptedAt: privacyPolicyAccepted ? new Date().toISOString() : null,
				ageConfirmed: ageConfirmed || false,
				ageConfirmedAt: ageConfirmed ? new Date().toISOString() : null,
				subscribeNewsletter: subscribe || false,
				subscribeNewsletterAt: subscribe ? new Date().toISOString() : null,
				isAirdrop: isAirdrop || false,
				certificateAlreadyExisted: certificateExists
			};

			userData.mints = [newMint];
			userData.totalMinted = 1;
			userData.lastMintedAt = mintedAt || new Date().toISOString();
		}

		// Send email for new user (only if NFT was minted)
		if (nftMinted && transactionHash && name && email) {
			try {
				const emailResult = await sendMintSuccessEmail(
					email,
					name,
					tokenId,
					ipfsData?.ipfsUrl || localImageUrl,
					isAirdrop
				);

				emailSent = emailResult.success;

				if (emailResult.success) {
					console.log(`✅ Mint success email sent to ${email}`);
				} else {
					console.error(`❌ Failed to send email to ${email}:`, emailResult.error);
				}
			} catch (emailError) {
				console.error('Error in email sending process:', emailError);
				emailSent = false;
			}
		}

		console.log('Creating new user with airdrop data:', { isAirdrop, certificateExists });

		await userRef.set(userData);

		res.status(201).json({
			success: true,
			message: certificateExists ?
				'User data stored with existing certificate' :
				'User data stored successfully with new certificate',
			userId: docId,
			tokenId: tokenId,
			certificateIpfsUrl: ipfsData?.ipfsUrl,
			ownershipCardUrl: localImageUrl,
			ipfsHash: ipfsData?.ipfsHash,
			totalMinted: userData.totalMinted,
			subscribeNewsletter: subscribe || false,
			isAirdrop: isAirdrop || false,
			certificateAlreadyExisted: certificateExists,
			emailSent: emailSent
		});

	} catch (error) {
		console.error('Error storing user data:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

// In your backend (server.js), update the /api/users/wallet/:walletAddress endpoint:
app.get('/api/users/wallet/:walletAddress', cors(corsOptions), async (req, res) => {
	try {
		const walletAddress = req.params.walletAddress;
		console.log(`Searching for wallet: ${walletAddress}`);

		// Create a composite index on a lowercase version of walletAddress
		// First, try to find by exact match
		let usersSnapshot = await db.collection('users')
			.where('walletAddress', '==', walletAddress)
			.limit(1)
			.get();

		if (usersSnapshot.empty) {
			// Try with lowercase
			usersSnapshot = await db.collection('users')
				.where('walletAddress', '==', walletAddress.toLowerCase())
				.limit(1)
				.get();
		}

		if (usersSnapshot.empty) {
			console.log(`No user found for wallet: ${walletAddress}`);
			return res.status(404).json({ error: 'User not found' });
		}

		const userDoc = usersSnapshot.docs[0];
		res.json({
			id: userDoc.id,
			...userDoc.data()
		});

	} catch (error) {
		console.error('Error fetching user by wallet:', error);
		res.status(500).json({
			error: 'Internal server error',
			details: error.message
		});
	}
});

// Add this endpoint after your existing /api/admin/identity-documents endpoint

app.get('/api/admin/tax-id-documents', cors(corsOptions), async (req, res) => {
	try {
		const {
			page = 1,
			limit = 10,
			status = 'all',
			search = '',
			sortBy = 'uploadedAt',
			sortOrder = 'desc'
		} = req.query;

		console.log('🔍 Fetching tax ID documents with filters:', { page, limit, status, search, sortBy, sortOrder });

		// Get all users for name and email lookup first
		const usersSnapshot = await db.collection('users').get();
		const userLookup = {};
		const emailLookup = {};
		usersSnapshot.forEach(doc => {
			const userData = doc.data();
			if (userData.walletAddress) {
				userLookup[userData.walletAddress.toLowerCase()] = userData.name || 'Anonymous';
				emailLookup[userData.walletAddress.toLowerCase()] = userData.email || 'No email';
			}
		});

		// Get all paypal documents with taxIdDocument
		const allPaypalSnapshot = await db.collection('paypal').get();

		let allDocuments = [];

		allPaypalSnapshot.forEach(doc => {
			const data = doc.data();

			// ✅ FIXED: Add the missing condition check
			if (data.taxIdDocument && data.taxIdDocument.ipfsUrl) {
				const document = {
					id: doc.id,
					walletAddress: data.walletAddress,
					userName: userLookup[data.walletAddress?.toLowerCase()] || 'Unknown',
					userEmail: emailLookup[data.walletAddress?.toLowerCase()] || 'No email',
					taxIdType: data.taxIdDocument.taxIdType,
					ipfsUrl: data.taxIdDocument.ipfsUrl,
					uploadedAt: data.taxIdDocument.uploadedAt,
					rejectionReason: data.taxIdDocument.rejectionReason || null,
					rejectedAt: data.taxIdDocument.rejectedAt || null,
					verified: data.taxIdDocument.verified || false,
					verifiedAt: data.taxIdDocument.verifiedAt || null
				};

				allDocuments.push(document);
			}
		});

		// Apply status filter
		let filteredDocuments = allDocuments;

		switch (status) {
			case 'pending':
				filteredDocuments = allDocuments.filter(doc => !doc.verified && !doc.rejectionReason);
				break;
			case 'approved':
				filteredDocuments = allDocuments.filter(doc => doc.verified);
				break;
			case 'rejected':
				filteredDocuments = allDocuments.filter(doc => doc.rejectionReason && !doc.verified);
				break;
			default: // 'all'
				filteredDocuments = allDocuments;
		}

		// Apply search filter - now includes user name and email search
		if (search) {
			const searchLower = search.toLowerCase();
			filteredDocuments = filteredDocuments.filter(doc =>
				doc.walletAddress.toLowerCase().includes(searchLower) ||
				doc.taxIdType.toLowerCase().includes(searchLower) ||
				doc.userName.toLowerCase().includes(searchLower) ||
				doc.userEmail.toLowerCase().includes(searchLower) ||
				(doc.rejectionReason && doc.rejectionReason.toLowerCase().includes(searchLower))
			);
		}

		// Apply sorting
		filteredDocuments.sort((a, b) => {
			let aVal = a[sortBy];
			let bVal = b[sortBy];

			// Handle date sorting
			if (sortBy.includes('At')) {
				aVal = new Date(aVal || 0);
				bVal = new Date(bVal || 0);
			}

			if (sortOrder === 'desc') {
				return bVal > aVal ? 1 : -1;
			} else {
				return aVal > bVal ? 1 : -1;
			}
		});

		// Calculate pagination
		const totalDocuments = filteredDocuments.length;
		const totalPages = Math.ceil(totalDocuments / limit);
		const offset = (page - 1) * limit;
		const paginatedDocuments = filteredDocuments.slice(offset, offset + parseInt(limit));

		// Calculate stats
		const stats = {
			total: allDocuments.length,
			pending: allDocuments.filter(doc => !doc.verified && !doc.rejectionReason).length,
			approved: allDocuments.filter(doc => doc.verified).length,
			rejected: allDocuments.filter(doc => doc.rejectionReason && !doc.verified).length
		};

		res.json({
			success: true,
			documents: paginatedDocuments,
			pagination: {
				currentPage: parseInt(page),
				totalPages: totalPages,
				totalDocuments: totalDocuments,
				limit: parseInt(limit),
				hasNextPage: page < totalPages,
				hasPrevPage: page > 1
			},
			stats: stats
		});

	} catch (error) {
		console.error('❌ Error fetching tax ID documents:', error);
		res.status(500).json({
			error: 'Internal server error',
			details: error.message
		});
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

// New endpoint to download archive (all certificates + Autograph and Coin folder)
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

		// 5. Add Autograph and Coin folder if exists
		const signAndSongPath = path.join(__dirname, 'Autograph and Coin');
		if (fs.existsSync(signAndSongPath)) {
			console.log('Adding Autograph and Coin folder');
			archive.directory(signAndSongPath, 'Autograph and Coin');
		} else {
			console.warn('Autograph and Coin folder not found');
			archive.append('Additional content folder not found. Please contact support if you believe this content should be available.', {
				name: 'Autograph and Coin/README.txt'
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
2. /Autograph and Coin/ - Additional project content and assets

Notes:
- This archive only includes certificates for NFTs you currently own
- If you previously owned NFTs that were transferred/sold, those certificates are not included
- If you believe there's an error with your certificates, please contact support

Support: Contact the MUSE team for any issues with your archive
`;
		//archive.append(readmeContent, { name: 'README.txt' });

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
		console.log("walletAddress in get method:", walletAddress);

		// Use the correct method for your contract
		const tokenIds = await getCurrentlyOwnedTokenIds(walletAddress);

		res.json({
			walletAddress,
			balance: tokenIds.length,
			tokenIds,
			method: 'userMinted + walletToTokenIds + ownerOf verification'
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
// Replace your getCurrentlyOwnedTokenIds function with this improved version:

async function getCurrentlyOwnedTokenIds(walletAddress) {
	try {
		console.log(`Checking ownership for wallet: ${walletAddress}`);

		// Use getWalletTokenIds directly - your contract handles transfers correctly
		const tokenIds = await nftContract.methods.getWalletTokenIds(walletAddress).call();
		console.log(`Found tokens for ${walletAddress}:`, tokenIds);

		return tokenIds.map(id => id.toString());

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

app.post('/api/test-email', cors(corsOptions), async (req, res) => {
	try {
		const { email, name } = req.body;

		if (!email) {
			return res.status(400).json({ error: 'Email is required' });
		}

		// Use default name if not provided
		const testName = name || 'Test User';
		const testTokenId = 99999; // Test token ID
		const testCertificateUrl = 'https://example.com/test-certificate.png'; // Test certificate URL

		console.log(`Sending test email to: ${email}`);

		// Send test email
		const emailResult = await sendMintSuccessEmail(
			email,
			testName,
			testTokenId,
			testCertificateUrl,
			false // isAirdrop = false for regular mint test
		);

		if (emailResult.success) {
			console.log(`✅ Test email sent successfully to ${email}`);
			res.json({
				success: true,
				message: 'Test email sent successfully',
				email: email,
				name: testName,
				messageId: emailResult.messageId
			});
		} else {
			console.error(`❌ Failed to send test email to ${email}:`, emailResult.error);
			res.status(500).json({
				success: false,
				error: 'Failed to send test email',
				details: emailResult.error
			});
		}

	} catch (error) {
		console.error('Error sending test email:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error',
			details: error.message
		});
	}
});

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

const calculateUserPayout = async (userData) => {
	try {
		console.log('🔍 Starting payout calculation for user:', userData?.email || 'unknown');

		const userNFTsOwned = userData.totalMinted || 0;
		console.log('📊 User NFTs owned:', userNFTsOwned);

		// Get total supply from contract
		let totalSupply = 0;
		try {
			const contractTotalSupply = await nftContract.methods.totalSupply().call();
			totalSupply = Number(contractTotalSupply);
			console.log('📊 Contract Total Supply:', totalSupply);

			if (totalSupply <= 0) {
				console.warn('⚠️ Total supply is 0, using fallback of 1');
				totalSupply = 1;
			}
		} catch (contractError) {
			console.error('❌ Error fetching total supply from contract:', contractError);
			totalSupply = Math.max(userNFTsOwned, 1);
			console.log('📊 Using fallback total supply:', totalSupply);
		}

		// Get CURRENT ACTIVE disbursement amount
		const limitsDoc = await db.collection('admin_settings').doc('payout_limits').get();
		let currentDisbursementAmount = 0;
		let currentDisbursementId = null;

		if (limitsDoc.exists) {
			const limitsData = limitsDoc.data();
			currentDisbursementAmount = limitsData.totalLimit || 0;
			currentDisbursementId = limitsData.disbursementId;
			console.log('📊 Current Active Disbursement Amount:', currentDisbursementAmount);
			console.log('📊 Current Disbursement ID:', currentDisbursementId);
		} else {
			console.warn('⚠️ No disbursement amount configured');
		}

		if (currentDisbursementAmount <= 0) {
			console.warn('⚠️ No active disbursement amount set');
			return {
				availableAmount: 0,
				totalEligible: 0,
				totalWithdrawn: 0,
				sharePercentage: 0,
				disbursementAmount: 0,
				totalSupply: totalSupply,
				userNFTsOwned: userNFTsOwned,
				error: 'No active disbursement pool configured'
			};
		}

		// Calculate share percentage and eligible amount from CURRENT disbursement
		const sharePercentage = userNFTsOwned / totalSupply;
		const currentDisbursementEligible = currentDisbursementAmount * sharePercentage;

		// Get user's withdrawal data using the helper function
		const walletAddress = userData.walletAddress;
		let totalWithdrawnAllTime = 0;
		let withdrawnFromCurrentDisbursement = 0;

		if (walletAddress) {
			try {
				const withdrawalData = await getUserWithdrawalsByDisbursement(walletAddress);
				totalWithdrawnAllTime = withdrawalData.totalWithdrawnAllTime;

				// Get amount withdrawn from current disbursement specifically
				if (currentDisbursementId && withdrawalData.withdrawalsByDisbursement[currentDisbursementId]) {
					withdrawnFromCurrentDisbursement = withdrawalData.withdrawalsByDisbursement[currentDisbursementId];
				}

				console.log('📊 Total withdrawn across all disbursements:', totalWithdrawnAllTime);
				console.log('📊 Withdrawn from current disbursement:', withdrawnFromCurrentDisbursement);
			} catch (error) {
				console.error('Error fetching withdrawal history:', error);
				totalWithdrawnAllTime = 0;
				withdrawnFromCurrentDisbursement = 0;
			}
		}

		// Available amount calculation:
		// Can withdraw from current disbursement minus what's already withdrawn from current disbursement
		const availableAmount = Math.max(0, currentDisbursementEligible - withdrawnFromCurrentDisbursement);

		console.log('📊 Final Calculation:', {
			userNFTs: userNFTsOwned,
			totalSupply: totalSupply,
			sharePercentage: (sharePercentage * 100).toFixed(3) + '%',
			currentDisbursementAmount: currentDisbursementAmount,
			currentDisbursementEligible: currentDisbursementEligible,
			totalWithdrawnAllTime: totalWithdrawnAllTime,
			withdrawnFromCurrentDisbursement: withdrawnFromCurrentDisbursement,
			availableAmount: availableAmount
		});

		const result = {
			availableAmount: Number(availableAmount.toFixed(2)),
			totalEligible: Number(currentDisbursementEligible.toFixed(2)),
			totalWithdrawn: Number(totalWithdrawnAllTime.toFixed(2)),
			withdrawnFromCurrentDisbursement: Number(withdrawnFromCurrentDisbursement.toFixed(2)),
			sharePercentage: Number((sharePercentage * 100).toFixed(3)),
			disbursementAmount: Number(currentDisbursementAmount),
			totalSupply: Number(totalSupply),
			userNFTsOwned: Number(userNFTsOwned),
			currentDisbursementId: currentDisbursementId
		};

		console.log('✅ Final calculation result:', result);
		return result;

	} catch (error) {
		console.error('❌ Error calculating payout:', error);
		return {
			availableAmount: 0,
			totalEligible: 0,
			totalWithdrawn: 0,
			sharePercentage: 0,
			disbursementAmount: 0,
			totalSupply: 0,
			userNFTsOwned: userData?.totalMinted || 0,
			error: error.message
		};
	}
};

// Get total payout pool from your system
const getTotalPayoutPool = async () => {
	try {
		// You'll need to implement this based on your business logic
		// This could come from:
		// - Smart contract royalties
		// - Sales revenue
		// - Manual deposits by admin

		const poolDoc = await db.collection('admin').doc('payoutPool').get();
		if (poolDoc.exists) {
			return poolDoc.data().totalAmount || 0;
		}
		return 0;
	} catch (error) {
		console.error('Error getting payout pool:', error);
		return 0;
	}
};

// Get user's payout history
const getUserPayoutHistory = async (email) => {
	try {
		const payoutsSnapshot = await db.collection('payouts')
			.where('userEmail', '==', email)
			.orderBy('createdAt', 'desc')
			.get();

		const payouts = [];
		payoutsSnapshot.forEach(doc => {
			payouts.push({ id: doc.id, ...doc.data() });
		});

		return payouts;
	} catch (error) {
		console.error('Error fetching payout history:', error);
		return [];
	}
};

// ============================================
// PAYOUT API ENDPOINTS
// ============================================

// Get user's payout information
app.get('/api/users/:email/payout-info', cors(corsOptions), async (req, res) => {
	try {
		const email = req.params.email;
		const docId = email.toLowerCase().replace(/[^a-z0-9]/g, '_');

		// Get user data
		const userDoc = await db.collection('users').doc(docId).get();
		if (!userDoc.exists) {
			return res.status(404).json({ error: 'User not found' });
		}

		const userData = userDoc.data();

		// Calculate payout eligibility
		const payoutInfo = await calculateUserPayout(userData);

		// Get payout history
		const payoutHistory = await getUserPayoutHistory(email);

		res.json({
			success: true,
			payoutInfo: payoutInfo,
			payoutHistory: payoutHistory,
			hasPayPalEmail: !!userData.paypalEmail
		});

	} catch (error) {
		console.error('Error fetching payout info:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

// MAKE SURE you have this endpoint in your server.js

// Admin endpoint to update identity document verification status - NO ADMIN KEY
app.put('/api/admin/paypal/:walletAddress/verify-identity', cors(corsOptions), async (req, res) => {
	try {
		const { walletAddress } = req.params;
		const { verified, rejectionReason } = req.body;

		console.log(`🔍 Verifying identity document for wallet: ${walletAddress}`, { verified, rejectionReason });

		// Find the document in the paypal collection
		const paypalSnapshot = await db.collection('paypal')
			.where('walletAddress', '==', walletAddress)
			.limit(1)
			.get();

		if (paypalSnapshot.empty) {
			return res.status(404).json({
				error: 'Document not found for this wallet address'
			});
		}

		const docRef = paypalSnapshot.docs[0].ref;
		const updateData = {
			'identityDocument.verified': verified,
			'identityDocument.verifiedAt': verified ? new Date().toISOString() : null,
			'identityDocument.rejectionReason': verified ? null : rejectionReason,
			'identityDocument.rejectedAt': verified ? null : new Date().toISOString()
		};

		await docRef.update(updateData);

		res.json({
			success: true,
			message: verified ? 'Identity document approved successfully' : 'Identity document rejected successfully',
			verified: verified,
			rejectionReason: rejectionReason || null
		});

	} catch (error) {
		console.error('❌ Error updating identity verification status:', error);
		res.status(500).json({
			error: 'Internal server error',
			details: error.message
		});
	}
});

app.get('/api/admin/identity-documents', cors(corsOptions), async (req, res) => {
	try {
		const {
			page = 1,
			limit = 10,
			status = 'all',
			search = '',
			sortBy = 'uploadedAt',
			sortOrder = 'desc'
		} = req.query;

		console.log('🔍 Fetching identity documents with filters:', { page, limit, status, search, sortBy, sortOrder });

		// Get all users for name lookup first
		const usersSnapshot = await db.collection('users').get();
		const userLookup = {};
		const emailLookup = {};
		usersSnapshot.forEach(doc => {
			const userData = doc.data();
			if (userData.walletAddress) {
				userLookup[userData.walletAddress.toLowerCase()] = userData.name || 'Anonymous';
				emailLookup[userData.walletAddress.toLowerCase()] = userData.email || 'No email';
			}
		});

		// Get all paypal documents with identityDocument
		const allPaypalSnapshot = await db.collection('paypal').get();

		let allDocuments = [];

		allPaypalSnapshot.forEach(doc => {
			const data = doc.data();

			// ✅ FIXED: Check for correct structure in Firebase
			if (data.identityDocument) {
				// Handle both old and new data structures
				let frontImageUrl = null;
				let backImageUrl = null;

				// New structure: identityDocument.frontImage.ipfsUrl
				if (data.identityDocument.frontImage && data.identityDocument.frontImage.ipfsUrl) {
					frontImageUrl = data.identityDocument.frontImage.ipfsUrl;
				}
				// Old structure: identityDocument.frontImageUrl (fallback)
				else if (data.identityDocument.frontImageUrl) {
					frontImageUrl = data.identityDocument.frontImageUrl;
				}
				// Legacy structure: identityDocument.ipfsUrl (single image)
				else if (data.identityDocument.ipfsUrl) {
					frontImageUrl = data.identityDocument.ipfsUrl;
				}

				// Back image check
				if (data.identityDocument.backImage && data.identityDocument.backImage.ipfsUrl) {
					backImageUrl = data.identityDocument.backImage.ipfsUrl;
				}
				else if (data.identityDocument.backImageUrl) {
					backImageUrl = data.identityDocument.backImageUrl;
				}

				// Only include documents that have at least a front image
				if (frontImageUrl) {
					const document = {
						id: doc.id,
						walletAddress: data.walletAddress,
						userName: userLookup[data.walletAddress?.toLowerCase()] || 'Unknown',
						userEmail: emailLookup[data.walletAddress?.toLowerCase()] || 'No email',
						documentType: data.identityDocument.documentType || 'identity_document',
						frontImageUrl: frontImageUrl,
						backImageUrl: backImageUrl,
						hasBackImage: !!backImageUrl,
						uploadedAt: data.identityDocument.uploadedAt,
						rejectionReason: data.identityDocument.rejectionReason || null,
						rejectedAt: data.identityDocument.rejectedAt || null,
						verified: data.identityDocument.verified || false,
						verifiedAt: data.identityDocument.verifiedAt || null
					};

					allDocuments.push(document);
					console.log('✅ Found identity document for:', data.walletAddress, {
						frontImage: !!frontImageUrl,
						backImage: !!backImageUrl,
						verified: document.verified
					});
				}
			}
		});

		console.log(`📊 Total identity documents found: ${allDocuments.length}`);

		// Apply status filter
		let filteredDocuments = allDocuments;

		switch (status) {
			case 'pending':
				filteredDocuments = allDocuments.filter(doc => !doc.verified && !doc.rejectionReason);
				break;
			case 'approved':
				filteredDocuments = allDocuments.filter(doc => doc.verified);
				break;
			case 'rejected':
				filteredDocuments = allDocuments.filter(doc => doc.rejectionReason && !doc.verified);
				break;
			default: // 'all'
				filteredDocuments = allDocuments;
		}

		console.log(`📊 After status filter (${status}): ${filteredDocuments.length} documents`);

		// Apply search filter - includes user name search
		if (search) {
			const searchLower = search.toLowerCase();
			filteredDocuments = filteredDocuments.filter(doc =>
				doc.walletAddress.toLowerCase().includes(searchLower) ||
				doc.documentType.toLowerCase().includes(searchLower) ||
				doc.userName.toLowerCase().includes(searchLower) ||
				doc.userEmail.toLowerCase().includes(searchLower) ||
				(doc.rejectionReason && doc.rejectionReason.toLowerCase().includes(searchLower))
			);
		}

		// Apply sorting
		filteredDocuments.sort((a, b) => {
			let aVal = a[sortBy];
			let bVal = b[sortBy];

			// Handle date sorting
			if (sortBy.includes('At')) {
				aVal = new Date(aVal || 0);
				bVal = new Date(bVal || 0);
			}

			if (sortOrder === 'desc') {
				return bVal > aVal ? 1 : -1;
			} else {
				return aVal > bVal ? 1 : -1;
			}
		});

		// Calculate pagination
		const totalDocuments = filteredDocuments.length;
		const totalPages = Math.ceil(totalDocuments / limit);
		const offset = (page - 1) * limit;
		const paginatedDocuments = filteredDocuments.slice(offset, offset + parseInt(limit));

		// Calculate stats
		const stats = {
			total: allDocuments.length,
			pending: allDocuments.filter(doc => !doc.verified && !doc.rejectionReason).length,
			approved: allDocuments.filter(doc => doc.verified).length,
			rejected: allDocuments.filter(doc => doc.rejectionReason && !doc.verified).length
		};

		console.log('📊 Final stats:', stats);
		console.log('📊 Returning documents:', paginatedDocuments.length);

		res.json({
			success: true,
			documents: paginatedDocuments,
			pagination: {
				currentPage: parseInt(page),
				totalPages: totalPages,
				totalDocuments: totalDocuments,
				limit: parseInt(limit),
				hasNextPage: page < totalPages,
				hasPrevPage: page > 1
			},
			stats: stats
		});

	} catch (error) {
		console.error('❌ Error fetching identity documents:', error);
		res.status(500).json({
			error: 'Internal server error',
			details: error.message
		});
	}
});

app.post('/api/admin/search-users', cors(corsOptions), async (req, res) => {
	try {
		const { searchMethod, searchValue } = req.body;

		if (!searchMethod || !searchValue) {
			return res.status(400).json({
				success: false,
				error: 'Search method and value are required'
			});
		}

		console.log('🔍 Admin user search:', { searchMethod, searchValue });

		// Get all users from the users collection
		const usersSnapshot = await db.collection('users').get();
		let matchedUsers = [];

		// Search through users based on method
		usersSnapshot.forEach(doc => {
			const userData = doc.data();
			const searchTerm = searchValue.toLowerCase().trim();

			let isMatch = false;

			switch (searchMethod) {
				case 'wallet':
					if (userData.walletAddress &&
						userData.walletAddress.toLowerCase().includes(searchTerm)) {
						isMatch = true;
					}
					break;

				case 'name':
					if (userData.name &&
						userData.name.toLowerCase().includes(searchTerm)) {
						isMatch = true;
					}
					break;

				case 'email':
					if (userData.email &&
						userData.email.toLowerCase().includes(searchTerm)) {
						isMatch = true;
					}
					break;

				default:
					console.warn('Unknown search method:', searchMethod);
			}

			if (isMatch) {
				matchedUsers.push({
					id: doc.id,
					name: userData.name || null,
					email: userData.email || null,
					walletAddress: userData.walletAddress || null,
					totalMinted: userData.totalMinted || 0,
					nftMinted: userData.nftMinted || false,
					createdAt: userData.createdAt || null
				});
			}
		});

		// Sort results by name, then by email
		matchedUsers.sort((a, b) => {
			const nameA = a.name || '';
			const nameB = b.name || '';
			if (nameA !== nameB) {
				return nameA.localeCompare(nameB);
			}
			const emailA = a.email || '';
			const emailB = b.email || '';
			return emailA.localeCompare(emailB);
		});

		// Limit results to prevent overwhelming the UI
		const maxResults = 50;
		if (matchedUsers.length > maxResults) {
			matchedUsers = matchedUsers.slice(0, maxResults);
		}

		console.log(`✅ Found ${matchedUsers.length} users matching search`);

		res.json({
			success: true,
			users: matchedUsers,
			totalFound: matchedUsers.length,
			searchMethod: searchMethod,
			searchValue: searchValue,
			truncated: matchedUsers.length === maxResults
		});

	} catch (error) {
		console.error('❌ Error searching users:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to search users',
			details: error.message
		});
	}
});

app.post('/api/admin/search-users-advanced', cors(corsOptions), async (req, res) => {
	try {
		const { searchMethod, searchValue, exactMatch = false } = req.body;

		if (!searchMethod || !searchValue) {
			return res.status(400).json({
				success: false,
				error: 'Search method and value are required'
			});
		}

		console.log('🔍 Advanced admin user search:', { searchMethod, searchValue, exactMatch });

		// Get all users from the users collection
		const usersSnapshot = await db.collection('users').get();
		let matchedUsers = [];

		// Helper function for fuzzy matching
		const fuzzyMatch = (text, search) => {
			if (!text) return false;
			const textLower = text.toLowerCase();
			const searchLower = search.toLowerCase();

			// Exact match
			if (textLower.includes(searchLower)) return true;

			// If not exact match required, try fuzzy matching
			if (!exactMatch) {
				// Split search into words and check if all words are found
				const searchWords = searchLower.split(' ').filter(word => word.length > 0);
				return searchWords.every(word => textLower.includes(word));
			}

			return false;
		};

		// Search through users based on method
		usersSnapshot.forEach(doc => {
			const userData = doc.data();
			const searchTerm = searchValue.trim();

			let isMatch = false;
			let matchScore = 0;

			switch (searchMethod) {
				case 'wallet':
					if (userData.walletAddress) {
						if (exactMatch) {
							isMatch = userData.walletAddress.toLowerCase() === searchTerm.toLowerCase();
							matchScore = isMatch ? 100 : 0;
						} else {
							isMatch = userData.walletAddress.toLowerCase().includes(searchTerm.toLowerCase());
							matchScore = isMatch ?
								(userData.walletAddress.toLowerCase().startsWith(searchTerm.toLowerCase()) ? 90 : 70) : 0;
						}
					}
					break;

				case 'name':
					if (userData.name) {
						isMatch = fuzzyMatch(userData.name, searchTerm);
						if (isMatch) {
							// Higher score for exact matches
							if (userData.name.toLowerCase() === searchTerm.toLowerCase()) {
								matchScore = 100;
							} else if (userData.name.toLowerCase().startsWith(searchTerm.toLowerCase())) {
								matchScore = 90;
							} else {
								matchScore = 70;
							}
						}
					}
					break;

				case 'email':
					if (userData.email) {
						isMatch = fuzzyMatch(userData.email, searchTerm);
						if (isMatch) {
							// Higher score for exact matches
							if (userData.email.toLowerCase() === searchTerm.toLowerCase()) {
								matchScore = 100;
							} else if (userData.email.toLowerCase().startsWith(searchTerm.toLowerCase())) {
								matchScore = 90;
							} else {
								matchScore = 70;
							}
						}
					}
					break;

				default:
					console.warn('Unknown search method:', searchMethod);
			}

			if (isMatch) {
				matchedUsers.push({
					id: doc.id,
					name: userData.name || null,
					email: userData.email || null,
					walletAddress: userData.walletAddress || null,
					totalMinted: userData.totalMinted || 0,
					nftMinted: userData.nftMinted || false,
					createdAt: userData.createdAt || null,
					matchScore: matchScore
				});
			}
		});

		// Sort by match score (highest first), then by name
		matchedUsers.sort((a, b) => {
			if (b.matchScore !== a.matchScore) {
				return b.matchScore - a.matchScore;
			}
			const nameA = a.name || '';
			const nameB = b.name || '';
			return nameA.localeCompare(nameB);
		});

		// Limit results to prevent overwhelming the UI
		const maxResults = 50;
		if (matchedUsers.length > maxResults) {
			matchedUsers = matchedUsers.slice(0, maxResults);
		}

		console.log(`✅ Found ${matchedUsers.length} users matching advanced search`);

		res.json({
			success: true,
			users: matchedUsers,
			totalFound: matchedUsers.length,
			searchMethod: searchMethod,
			searchValue: searchValue,
			exactMatch: exactMatch,
			truncated: matchedUsers.length === maxResults
		});

	} catch (error) {
		console.error('❌ Error in advanced user search:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to search users',
			details: error.message
		});
	}
});


app.put('/api/paypal/:walletAddress/email', cors(corsOptions), async (req, res) => {
	try {
		const walletAddress = req.params.walletAddress;
		const { paypalEmail } = req.body;

		console.log('🔧 DEBUGGING PayPal Email Update Backend:');
		console.log('Wallet Address:', walletAddress);
		console.log('New PayPal Email:', paypalEmail);

		// Validate PayPal email format
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(paypalEmail)) {
			return res.status(400).json({ error: 'Invalid PayPal email format' });
		}

		// Use wallet address as document ID (lowercase for consistency)
		const docId = walletAddress.toLowerCase();
		const paypalRef = db.collection('paypal').doc(docId);

		// Check if document exists
		const doc = await paypalRef.get();

		if (doc.exists) {
			// Update existing PayPal record
			await paypalRef.update({
				paypalEmail: paypalEmail.toLowerCase(),
				updatedAt: new Date().toISOString()
			});
			console.log('✅ Updated existing PayPal record');
		} else {
			// Create new PayPal record
			await paypalRef.set({
				walletAddress: walletAddress.toLowerCase(),
				paypalEmail: paypalEmail.toLowerCase(),
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				payouts: [] // Initialize empty payouts array
			});
			console.log('✅ Created new PayPal record');
		}

		res.json({
			success: true,
			message: 'PayPal email updated successfully',
			paypalEmail: paypalEmail.toLowerCase()
		});

	} catch (error) {
		console.error('❌ Error updating PayPal email:', error);
		res.status(500).json({
			error: 'Internal server error',
			details: error.message
		});
	}
});

// 2. ADD: Get PayPal data endpoint
app.get('/api/paypal/:walletAddress', cors(corsOptions), async (req, res) => {
	try {
		const walletAddress = req.params.walletAddress;
		console.log('🔧 Backend: Fetching PayPal data for wallet:', walletAddress);

		const paypalDoc = await db.collection('paypal').doc(walletAddress.toLowerCase()).get();

		if (!paypalDoc.exists) {
			console.log('📝 Backend: No PayPal data found');
			return res.status(404).json({
				error: 'PayPal data not found',
				paypalEmail: null,
				payouts: []
			});
		}

		const data = paypalDoc.data();
		console.log('✅ Backend: PayPal data found:', data);

		res.json({
			success: true,
			paypalEmail: data.paypalEmail || null,
			payouts: data.payouts || [],
			walletAddress: data.walletAddress,
			createdAt: data.createdAt,
			updatedAt: data.updatedAt
		});

	} catch (error) {
		console.error('❌ Backend: Error fetching PayPal data:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

app.post('/api/paypal/:walletAddress/request-payout', cors(corsOptions), async (req, res) => {
	try {
		const walletAddress = req.params.walletAddress;
		const { amount: requestedAmount } = req.body;

		console.log('🔧 Processing payout request for wallet:', walletAddress);
		console.log('💰 Requested amount from user:', requestedAmount);

		// Get and validate PayPal data
		const paypalRef = db.collection('paypal').doc(walletAddress.toLowerCase());
		const paypalDoc = await paypalRef.get();

		if (!paypalDoc.exists || !paypalDoc.data().paypalEmail) {
			return res.status(400).json({ error: 'PayPal email not configured' });
		}

		const paypalData = paypalDoc.data();

		// Security validations
		if (!paypalData.identityDocument || !paypalData.identityDocument.verified) {
			return res.status(400).json({
				error: 'Identity verification required before withdrawals'
			});
		}

		if (!paypalData.taxIdDocument || !paypalData.taxIdDocument.verified) {
			return res.status(400).json({
				error: 'Tax ID verification required before withdrawals'
			});
		}

		// Check for pending payouts
		const existingPayouts = paypalData.payouts || [];
		const pendingPayouts = existingPayouts.filter(payout =>
			payout.status === 'pending' ||
			payout.status === 'processing' ||
			payout.paypalStatus === 'PENDING'
		);

		if (pendingPayouts.length > 0) {
			return res.status(400).json({
				error: 'You have a pending payout. Please wait for it to complete.'
			});
		}

		// Get user data and calculate available payout
		const userSnapshot = await db.collection('users')
			.where('walletAddress', '==', walletAddress)
			.get();

		if (userSnapshot.empty) {
			return res.status(404).json({ error: 'User not found' });
		}

		const userData = userSnapshot.docs[0].data();

		// Calculate available payout using the backend function
		const payoutCalculation = await calculateUserPayout(userData);

		if (payoutCalculation.error) {
			return res.status(400).json({ error: payoutCalculation.error });
		}

		const availableAmount = Number(payoutCalculation.availableAmount) || 0;
		const withdrawAmount = requestedAmount ? parseFloat(requestedAmount) : availableAmount;

		console.log('📊 Available amount:', availableAmount.toFixed(2));
		console.log('💵 Withdrawal amount:', withdrawAmount.toFixed(2));

		// Validate withdrawal amount
		if (!withdrawAmount || withdrawAmount < 1.00) {
			return res.status(400).json({
				error: `Minimum payout amount is $1.00. You requested: $${withdrawAmount?.toFixed(2) || '0.00'}`
			});
		}

		if (withdrawAmount > availableAmount) {
			return res.status(400).json({
				error: `Requested amount exceeds available balance. Requested: $${withdrawAmount.toFixed(2)}, Available: $${availableAmount.toFixed(2)}`
			});
		}

		// Check the remaining balance rule
		const remainingAfterWithdrawal = availableAmount - withdrawAmount;
		if (remainingAfterWithdrawal > 0 && remainingAfterWithdrawal < 1.00) {
			return res.status(400).json({
				error: `Withdrawal would leave $${remainingAfterWithdrawal.toFixed(2)}. Please withdraw the full amount or leave at least $1.00`
			});
		}

		// Check if disbursement pool has enough funds
		const limitsDoc = await db.collection('admin_settings').doc('payout_limits').get();
		if (!limitsDoc.exists) {
			return res.status(400).json({
				error: 'Disbursement system not configured'
			});
		}

		const limitsData = limitsDoc.data();
		const remainingInPool = Math.max(0, (limitsData.totalLimit || 0) - (limitsData.usedAmount || 0));

		if (withdrawAmount > remainingInPool) {
			return res.status(400).json({
				error: `Insufficient funds in disbursement pool. Available in pool: $${remainingInPool.toFixed(2)}`
			});
		}

		// Get current disbursement ID for tracking
		const currentDisbursementId = limitsData.disbursementId || `disbursement_${Date.now()}`;

		// Create PayPal payout
		console.log('Processing PayPal payout...');
		console.log('Amount to withdraw:', withdrawAmount.toFixed(2));

		const payoutId = `payout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		const payoutRequest = new payoutsSDK.payouts.PayoutsPostRequest();
		payoutRequest.requestBody({
			sender_batch_header: {
				sender_batch_id: payoutId,
				email_subject: "Withdrawal from Hope KK NFTs",
				email_message: "You have received a withdrawal from your Hope KK NFT share."
			},
			items: [{
				recipient_type: "EMAIL",
				amount: {
					value: withdrawAmount.toFixed(2),
					currency: "USD"
				},
				receiver: paypalData.paypalEmail,
				note: `Hope KK NFT Share - ${userData.totalMinted} NFTs out of ${payoutCalculation.totalSupply} total`,
				sender_item_id: payoutId
			}]
		});

		const response = await paypalClient.execute(payoutRequest);

		// Update disbursement pool usage
		const newUsedAmount = (limitsData.usedAmount || 0) + withdrawAmount;
		await db.collection('admin_settings').doc('payout_limits').update({
			usedAmount: newUsedAmount,
			lastUpdated: new Date().toISOString(),
			// Ensure disbursementId exists for tracking
			...((!limitsData.disbursementId) && { disbursementId: currentDisbursementId })
		});

		// Record the payout with disbursement tracking
		const payoutData = {
			id: payoutId,
			amount: withdrawAmount,
			status: 'pending',
			paypalBatchId: response.result.batch_header.payout_batch_id,
			paypalStatus: response.result.batch_header.batch_status,
			requestedAt: new Date().toISOString(),
			processedAt: new Date().toISOString(),
			paypalEmail: paypalData.paypalEmail,
			walletAddress: walletAddress,
			userNFTs: userData.totalMinted,
			totalSupply: payoutCalculation.totalSupply,
			sharePercentage: payoutCalculation.sharePercentage,
			disbursementAmount: payoutCalculation.disbursementAmount,
			availableAtTimeOfWithdrawal: availableAmount,
			amountWithdrawn: withdrawAmount,
			disbursementId: currentDisbursementId // Add disbursement tracking
		};

		await paypalRef.update({
			payouts: [...existingPayouts, payoutData],
			lastPayoutAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		});

		console.log('✅ Payout submitted - Status:', response.result.batch_header.batch_status);
		console.log('💸 Amount requested:', withdrawAmount.toFixed(2));
		console.log('💰 Remaining available:', remainingAfterWithdrawal.toFixed(2));

		res.json({
			success: false, // Always false initially
			message: `Withdrawal request of $${withdrawAmount.toFixed(2)} has been submitted and is being processed. You will be notified once completed.`,
			payoutId: payoutId,
			amount: withdrawAmount,
			remainingBalance: remainingAfterWithdrawal,
			paypalBatchId: response.result.batch_header.payout_batch_id,
			sharePercentage: payoutCalculation.sharePercentage,
			estimatedArrival: '1-3 business days',
			status: 'pending',
			paypalStatus: response.result.batch_header.batch_status,
			disbursementId: currentDisbursementId,
			note: 'Your withdrawal is being processed. Check back later for status updates.'
		});

	} catch (error) {
		console.error('❌ Payout failed:', error);
		res.status(500).json({
			success: false,
			error: 'Withdrawal failed. Please try again.',
			details: error.message
		});
	}
});

// Get current payout limits
app.get('/api/admin/payout-limits', cors(corsOptions), async (req, res) => {
	try {
		const { adminKey } = req.query;

		if (adminKey !== process.env.ADMIN_KEY) {
			return res.status(401).json({ error: 'Unauthorized' });
		}

		const limitsDoc = await db.collection('admin').doc('payoutLimits').get();
		if (!limitsDoc.exists) {
			return res.json({
				totalLimit: 0,
				remainingLimit: 0,
				isSet: false
			});
		}

		res.json({
			...limitsDoc.data(),
			isSet: true
		});

	} catch (error) {
		console.error('Error getting payout limits:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

// Add this endpoint to manually check and update payout statuses
// Replace your existing /api/admin/refresh-payout-status/:walletAddress endpoint with this fixed version:

app.post('/api/admin/refresh-payout-status/:walletAddress', cors(corsOptions), async (req, res) => {
	try {
		const walletAddress = req.params.walletAddress;

		// Get PayPal data for this wallet
		const paypalDoc = await db.collection('paypal').doc(walletAddress.toLowerCase()).get();
		if (!paypalDoc.exists) {
			return res.status(404).json({ error: 'PayPal data not found' });
		}

		const paypalData = paypalDoc.data();
		const payouts = paypalData.payouts || [];

		// Find pending payouts with PayPal batch IDs
		const pendingPayouts = payouts.filter(payout =>
			(payout.status === 'pending' || payout.status === 'processing') &&
			payout.paypalBatchId
		);

		if (pendingPayouts.length === 0) {
			return res.json({
				success: true,
				message: 'No pending payouts to check',
				checkedPayouts: 0,
				updatedPayouts: 0
			});
		}

		let updatedCount = 0;

		// Check each pending payout with PayPal
		for (const payout of pendingPayouts) {
			try {
				console.log(`Checking PayPal status for batch: ${payout.paypalBatchId}`);

				const request = new payoutsSDK.payouts.PayoutsGetRequest(payout.paypalBatchId);
				const response = await paypalClient.execute(request);

				const batchStatus = response.result.batch_header.batch_status;
				const payoutItem = response.result.items[0]; // First item

				console.log(`Batch ${payout.paypalBatchId} status: ${batchStatus}`);

				// Update the payout object - ONLY set defined values
				payout.paypalStatus = batchStatus;
				payout.lastChecked = new Date().toISOString();

				if (payoutItem) {
					// Only set values that exist
					if (payoutItem.transaction_status) {
						payout.itemStatus = payoutItem.transaction_status;
					}

					if (payoutItem.transaction_id) {
						payout.paypalTransactionId = payoutItem.transaction_id;
					}

					// Update our local status based on PayPal status
					if (payoutItem.transaction_status === 'SUCCESS') {
						payout.status = 'completed';
						payout.completedAt = new Date().toISOString();
						updatedCount++;
					} else if (
						payoutItem.transaction_status === 'FAILED' ||
						payoutItem.transaction_status === 'RETURNED' ||
						batchStatus === 'DENIED'
					) {
						payout.status = 'failed';

						// Handle error messages safely
						if (payoutItem.errors && payoutItem.errors.length > 0) {
							payout.failureReason = payoutItem.errors[0].message;
						} else if (batchStatus === 'DENIED') {
							payout.failureReason = 'Payout batch was denied by PayPal';
						} else {
							payout.failureReason = 'Transaction failed';
						}

						updatedCount++;
					}
				} else {
					// Handle case where there are no items in the response
					if (batchStatus === 'DENIED') {
						payout.status = 'failed';
						payout.failureReason = 'Payout batch was denied by PayPal';
						updatedCount++;
					}
				}

			} catch (error) {
				console.error(`Error checking payout ${payout.id}:`, error);
				payout.lastCheckError = error.message;
				payout.lastChecked = new Date().toISOString();
			}
		}

		// Save updated payouts back to database
		await db.collection('paypal').doc(walletAddress.toLowerCase()).update({
			payouts: payouts,
			lastStatusCheck: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		});

		res.json({
			success: true,
			message: `Checked ${pendingPayouts.length} pending payouts, updated ${updatedCount}`,
			checkedPayouts: pendingPayouts.length,
			updatedPayouts: updatedCount
		});

	} catch (error) {
		console.error('Error refreshing payout status:', error);
		res.status(500).json({
			error: 'Failed to refresh payout status',
			details: error.message
		});
	}
});

// Process payout request
app.post('/api/users/:email/request-payout', cors(corsOptions), async (req, res) => {
	try {
		const email = req.params.email;
		const docId = email.toLowerCase().replace(/[^a-z0-9]/g, '_');

		// Get user data
		const userDoc = await db.collection('users').doc(docId).get();
		if (!userDoc.exists) {
			return res.status(404).json({ error: 'User not found' });
		}

		const userData = userDoc.data();

		// Check if user has PayPal email
		if (!userData.paypalEmail) {
			return res.status(400).json({
				error: 'PayPal email is required. Please add your PayPal email first.'
			});
		}

		// Calculate payout eligibility
		const payoutInfo = await calculateUserPayout(userData);

		// Check if user has enough for payout
		if (payoutInfo.availablePayout < payoutInfo.minimumPayout) {
			return res.status(400).json({
				error: `Minimum payout amount is $${payoutInfo.minimumPayout}. You have $${payoutInfo.availablePayout.toFixed(2)} available.`
			});
		}

		// Check for pending payouts
		const pendingPayouts = await db.collection('payouts')
			.where('userEmail', '==', email)
			.where('status', '==', 'pending')
			.get();

		if (!pendingPayouts.empty) {
			return res.status(400).json({
				error: 'You have a pending payout request. Please wait for it to complete.'
			});
		}

		// Create payout record
		const payoutId = `payout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		const payoutData = {
			id: payoutId,
			userEmail: email,
			userName: userData.name,
			paypalEmail: userData.paypalEmail,
			amount: payoutInfo.availablePayout,
			currency: 'USD',
			status: 'pending',
			createdAt: new Date().toISOString(),
			nftCount: userData.totalMinted || 0,
			sharePercentage: payoutInfo.sharePercentage
		};

		// Store payout request
		await db.collection('payouts').doc(payoutId).set(payoutData);

		// Create PayPal payout
		const payoutRequest = new payoutsSDK.payouts.PayoutsPostRequest();
		payoutRequest.requestBody({
			sender_batch_header: {
				sender_batch_id: payoutId,
				email_subject: "You have a payout from Hope KK NFTs!",
				email_message: "You have received a payout from your Hope KK NFT royalties. Thank you for being part of our community!"
			},
			items: [
				{
					recipient_type: "EMAIL",
					amount: {
						value: payoutInfo.availablePayout.toFixed(2),
						currency: "USD"
					},
					receiver: userData.paypalEmail,
					note: `Hope KK NFT Royalty Payout - ${userData.totalMinted} NFTs owned`,
					sender_item_id: payoutId
				}
			]
		});

		// Execute PayPal payout
		const response = await paypalClient.execute(payoutRequest);

		// Update payout record with PayPal details
		await db.collection('payouts').doc(payoutId).update({
			paypalBatchId: response.result.batch_header.payout_batch_id,
			paypalStatus: response.result.batch_header.batch_status,
			paypalResponse: response.result,
			updatedAt: new Date().toISOString()
		});

		// Send confirmation email
		try {
			await sendPayoutConfirmationEmail(userData.email, userData.name, payoutInfo.availablePayout);
		} catch (emailError) {
			console.error('Failed to send payout confirmation email:', emailError);
		}

		res.json({
			success: true,
			message: 'Payout request submitted successfully!',
			payoutId: payoutId,
			amount: payoutInfo.availablePayout,
			paypalBatchId: response.result.batch_header.payout_batch_id
		});

	} catch (error) {
		console.error('Error processing payout:', error);

		// Update payout status to failed if it was created
		if (error.payoutId) {
			await db.collection('payouts').doc(error.payoutId).update({
				status: 'failed',
				errorMessage: error.message,
				updatedAt: new Date().toISOString()
			});
		}

		res.status(500).json({
			error: 'Failed to process payout request',
			details: error.message
		});
	}
});


// Add this function to run every hour
const checkPendingPayouts = async () => {
	try {
		console.log('🔄 Checking pending payouts...');

		// Get all PayPal documents with pending payouts
		const paypalSnapshot = await db.collection('paypal').get();

		for (const doc of paypalSnapshot.docs) {
			const data = doc.data();
			const payouts = data.payouts || [];

			const pendingPayouts = payouts.filter(payout =>
				(payout.status === 'pending' || payout.status === 'processing') &&
				payout.paypalBatchId
			);

			if (pendingPayouts.length === 0) continue;

			let hasUpdates = false;

			for (const payout of pendingPayouts) {
				try {
					const request = new payoutsSDK.payouts.PayoutsGetRequest(payout.paypalBatchId);
					const response = await paypalClient.execute(request);

					const payoutItem = response.result.items[0];

					if (payoutItem && payoutItem.transaction_status === 'SUCCESS') {
						payout.status = 'completed';
						payout.completedAt = new Date().toISOString();
						payout.paypalTransactionId = payoutItem.transaction_id;
						hasUpdates = true;

						console.log(`✅ Payout ${payout.id} completed`);
					} else if (payoutItem && (payoutItem.transaction_status === 'FAILED' || payoutItem.transaction_status === 'RETURNED')) {
						payout.status = 'failed';
						payout.failureReason = payoutItem.errors ? payoutItem.errors[0].message : 'Transaction failed';
						hasUpdates = true;

						console.log(`❌ Payout ${payout.id} failed`);
					}

				} catch (error) {
					console.error(`Error checking payout ${payout.id}:`, error);
				}
			}

			if (hasUpdates) {
				await doc.ref.update({
					payouts: payouts,
					lastAutoCheck: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				});
			}
		}

	} catch (error) {
		console.error('Error in automatic payout check:', error);
	}
};

// Run every hour (add this to your server startup)
setInterval(checkPendingPayouts, 60 * 60 * 1000); // Every hour

// Upload identity document endpoint
// Replace the identity upload endpoint with this improved version:

app.post('/api/paypal/:walletAddress/upload-identity', cors(corsOptions), async (req, res) => {
	try {
		const walletAddress = req.params.walletAddress;
		const { documentType, frontImage, backImage } = req.body;

		console.log('🔧 Identity document upload for wallet:', walletAddress);
		console.log('Document type:', documentType);

		if (!documentType || !frontImage) {
			return res.status(400).json({ error: 'Document type and front image are required' });
		}

		// Validate document type
		const validTypes = ['passport', 'drivers_license', 'national_id'];
		if (!validTypes.includes(documentType)) {
			return res.status(400).json({ error: 'Invalid document type' });
		}

		// Upload front image
		const frontBase64Data = frontImage.replace(/^data:image\/[a-z]+;base64,/, '');
		const frontImageBuffer = Buffer.from(frontBase64Data, 'base64');

		let frontIpfsData = null;
		try {
			frontIpfsData = await uploadToIPFSFromBuffer(frontImageBuffer, `identity_front_${walletAddress.toLowerCase()}_${Date.now()}.jpg`);
			console.log('Front document uploaded to IPFS:', frontIpfsData.ipfsUrl);
		} catch (ipfsError) {
			console.error('Front image IPFS upload failed:', ipfsError);
			return res.status(500).json({ error: 'Failed to upload front document to IPFS' });
		}

		// Upload back image if provided
		let backIpfsData = null;
		if (backImage) {
			try {
				const backBase64Data = backImage.replace(/^data:image\/[a-z]+;base64,/, '');
				const backImageBuffer = Buffer.from(backBase64Data, 'base64');
				backIpfsData = await uploadToIPFSFromBuffer(backImageBuffer, `identity_back_${walletAddress.toLowerCase()}_${Date.now()}.jpg`);
				console.log('Back document uploaded to IPFS:', backIpfsData.ipfsUrl);
			} catch (ipfsError) {
				console.error('Back image IPFS upload failed:', ipfsError);
				// Continue without back image if upload fails
			}
		}

		// Update PayPal collection with identity document
		const docId = walletAddress.toLowerCase();
		const paypalRef = db.collection('paypal').doc(docId);

		const doc = await paypalRef.get();
		const updateData = {
			identityDocument: {
				documentType: documentType,
				frontImage: {
					ipfsUrl: frontIpfsData.ipfsUrl,
					ipfsHash: frontIpfsData.ipfsHash
				},
				...(backIpfsData && {
					backImage: {
						ipfsUrl: backIpfsData.ipfsUrl,
						ipfsHash: backIpfsData.ipfsHash
					}
				}),
				uploadedAt: new Date().toISOString(),
				verified: false
			},
			updatedAt: new Date().toISOString()
		};

		if (doc.exists) {
			await paypalRef.update(updateData);
		} else {
			await paypalRef.set({
				walletAddress: walletAddress.toLowerCase(),
				...updateData,
				createdAt: new Date().toISOString(),
				payouts: []
			});
		}

		res.json({
			success: true,
			message: 'Identity document uploaded successfully',
			documentType: documentType,
			frontImageUrl: frontIpfsData.ipfsUrl,
			backImageUrl: backIpfsData?.ipfsUrl || null
		});

	} catch (error) {
		console.error('❌ Error uploading identity document:', error);
		res.status(500).json({
			error: 'Internal server error',
			details: error.message
		});
	}
});

// Tax ID document upload endpoint
app.post('/api/paypal/:walletAddress/upload-tax-id', cors(corsOptions), async (req, res) => {
	try {
		const walletAddress = req.params.walletAddress;
		const { taxIdType, documentImage } = req.body;

		console.log('🔧 Tax ID document upload for wallet:', walletAddress);
		console.log('Tax ID type:', taxIdType);

		if (!taxIdType || !documentImage) {
			return res.status(400).json({ error: 'Tax ID type and document image are required' });
		}

		// Validate tax ID type
		const validTaxIdTypes = ['ssn_card', 'tax_return', 'ein_letter', 'itin_letter', 'other'];
		if (!validTaxIdTypes.includes(taxIdType)) {
			return res.status(400).json({ error: 'Invalid tax ID document type' });
		}

		// Convert base64 to buffer
		const base64Data = documentImage.replace(/^data:image\/[a-z]+;base64,/, '');
		const imageBuffer = Buffer.from(base64Data, 'base64');

		// Upload to IPFS
		let ipfsData = null;
		try {
			ipfsData = await uploadToIPFSFromBuffer(imageBuffer, `tax_id_${walletAddress.toLowerCase()}_${Date.now()}.jpg`);
			console.log('Tax ID document uploaded to IPFS:', ipfsData.ipfsUrl);
		} catch (ipfsError) {
			console.error('Tax ID IPFS upload failed:', ipfsError);
			return res.status(500).json({ error: 'Failed to upload tax ID document to IPFS' });
		}

		// Update PayPal collection with tax ID document
		const docId = walletAddress.toLowerCase();
		const paypalRef = db.collection('paypal').doc(docId);

		const doc = await paypalRef.get();
		const updateData = {
			taxIdDocument: {
				taxIdType: taxIdType,
				ipfsUrl: ipfsData.ipfsUrl,
				ipfsHash: ipfsData.ipfsHash,
				uploadedAt: new Date().toISOString(),
				verified: false
			},
			updatedAt: new Date().toISOString()
		};

		if (doc.exists) {
			await paypalRef.update(updateData);
		} else {
			await paypalRef.set({
				walletAddress: walletAddress.toLowerCase(),
				...updateData,
				createdAt: new Date().toISOString(),
				payouts: []
			});
		}

		res.json({
			success: true,
			message: 'Tax ID document uploaded successfully',
			taxIdType: taxIdType,
			documentUrl: ipfsData.ipfsUrl
		});

	} catch (error) {
		console.error('❌ Error uploading tax ID document:', error);
		res.status(500).json({
			error: 'Internal server error',
			details: error.message
		});
	}
});

// Get tax ID document status
app.get('/api/paypal/:walletAddress/tax-id-status', cors(corsOptions), async (req, res) => {
	try {
		const walletAddress = req.params.walletAddress;
		const paypalDoc = await db.collection('paypal').doc(walletAddress.toLowerCase()).get();

		if (!paypalDoc.exists) {
			return res.json({
				hasDocument: false,
				taxIdType: null,
				verified: false,
				canUpload: true
			});
		}

		const data = paypalDoc.data();
		const taxIdDoc = data.taxIdDocument;

		if (!taxIdDoc) {
			return res.json({
				hasDocument: false,
				taxIdType: null,
				verified: false,
				canUpload: true
			});
		}

		res.json({
			hasDocument: true,
			taxIdType: taxIdDoc.taxIdType,
			verified: taxIdDoc.verified || false,
			uploadedAt: taxIdDoc.uploadedAt,
			rejectionReason: taxIdDoc.rejectionReason || null,
			rejectedAt: taxIdDoc.rejectedAt || null,
			verifiedAt: taxIdDoc.verifiedAt || null,
			canUpload: !taxIdDoc.verified
		});

	} catch (error) {
		console.error('❌ Error checking tax ID status:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

const retryRequest = async (fn, maxRetries = 3, baseDelay = 2000) => {
	for (let i = 0; i < maxRetries; i++) {
		try {
			return await fn();
		} catch (error) {
			if (i === maxRetries - 1) {
				console.error(`❌ All ${maxRetries} upload attempts failed`);
				throw error;
			}

			const delay = baseDelay * Math.pow(2, i); // Exponential backoff
			console.log(`⏳ Upload attempt ${i + 1} failed, retrying in ${delay}ms...`);
			await new Promise(resolve => setTimeout(resolve, delay));
		}
	}
};

const uploadToIPFSFromBuffer = async (buffer, fileName) => {
	try {
		// Validate buffer size (10MB max)
		if (buffer.length > 10 * 1024 * 1024) {
			throw new Error('Image size exceeds 10MB limit');
		}

		const formData = new FormData();
		formData.append('file', buffer, fileName);

		const config = {
			method: 'post',
			url: 'https://api.pinata.cloud/pinning/pinFileToIPFS',
			data: formData,
			headers: {
				'Authorization': `Bearer ${process.env.PINATA_JWT}`,
				...formData.getHeaders()
			},
			timeout: 60000, // Increased to 60 seconds for large images
			maxContentLength: 15 * 1024 * 1024, // 15MB
			maxBodyLength: 15 * 1024 * 1024,
			// Add axios retry configuration
			'axios-retry': {
				retries: 3,
				retryDelay: (retryCount) => {
					return retryCount * 2000; // 2s, 4s, 6s delays
				}
			}
		};

		console.log(`📤 Uploading ${(buffer.length / 1024 / 1024).toFixed(2)}MB to IPFS...`);

		const response = await axios(config);

		console.log('✅ IPFS upload successful:', response.data.IpfsHash);

		return {
			ipfsHash: response.data.IpfsHash,
			ipfsUrl: `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`
		};
	} catch (error) {
		console.error('❌ IPFS upload error:', error.message);

		if (error.code === 'ECONNABORTED') {
			throw new Error('IPFS upload timeout. Please try with a smaller image.');
		}

		if (error.response) {
			// Pinata API error
			throw new Error(`IPFS upload failed: ${error.response.data?.error || error.message}`);
		}

		throw new Error(`IPFS upload failed: ${error.message}`);
	}
};

// Get identity document status
// Get identity document status - UPDATED VERSION
app.get('/api/paypal/:walletAddress/identity-status', cors(corsOptions), async (req, res) => {
	try {
		const walletAddress = req.params.walletAddress;
		const paypalDoc = await db.collection('paypal').doc(walletAddress.toLowerCase()).get();

		if (!paypalDoc.exists) {
			return res.json({
				hasDocument: false,
				documentType: null,
				verified: false,
				canUpload: true
			});
		}

		const data = paypalDoc.data();
		const identityDoc = data.identityDocument;

		if (!identityDoc) {
			return res.json({
				hasDocument: false,
				documentType: null,
				verified: false,
				canUpload: true
			});
		}

		// User can upload if:
		// 1. No document exists, OR
		// 2. Document was rejected, OR  
		// 3. Document is still pending (not verified and no rejection reason)
		const canUpload = !identityDoc ||
			(identityDoc.rejectionReason) ||
			(!identityDoc.verified && !identityDoc.rejectionReason);

		res.json({
			hasDocument: true,
			documentType: identityDoc.documentType,
			verified: identityDoc.verified || false,
			uploadedAt: identityDoc.uploadedAt,
			rejectionReason: identityDoc.rejectionReason || null,
			rejectedAt: identityDoc.rejectedAt || null,
			verifiedAt: identityDoc.verifiedAt || null,
			canUpload: !identityDoc.verified,
			frontImageUrl: identityDoc.frontImage?.ipfsUrl || identityDoc.ipfsUrl, // Backward compatibility
			backImageUrl: identityDoc.backImage?.ipfsUrl || null,
			hasBothSides: !!(identityDoc.frontImage && identityDoc.backImage)
		});

	} catch (error) {
		console.error('❌ Error checking identity status:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

// ADD this endpoint to your server.js to check the status of your payout

app.get('/api/check-batch-status/:batchId', cors(corsOptions), async (req, res) => {
	try {
		const { batchId } = req.params;

		console.log(`Checking status for batch: ${batchId}`);

		const request = new payoutsSDK.payouts.PayoutsGetRequest(batchId);
		const response = await paypalClient.execute(request);

		console.log('Batch Status:', response.result.batch_header.batch_status);
		console.log('Items:', response.result.items);

		res.json({
			success: true,
			batchId: batchId,
			batchStatus: response.result.batch_header.batch_status,
			totalAmount: response.result.batch_header.amount.value,
			currency: response.result.batch_header.amount.currency,
			items: response.result.items.map(item => ({
				transactionId: item.transaction_id || 'N/A',
				status: item.transaction_status || 'PENDING',
				recipient: item.payout_item.receiver,
				amount: item.payout_item.amount.value,
				note: item.payout_item.note,
				timeProcessed: item.time_processed || 'Not processed yet'
			}))
		});

	} catch (error) {
		console.error('Error checking batch status:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to check batch status',
			details: error.message
		});
	}
});

// Test this by visiting:
// http://localhost:5000/api/check-batch-status/4EA8FJP6CXNYA

// Admin endpoint to check payout status and update
app.post('/api/admin/update-payout-status/:payoutId', cors(corsOptions), async (req, res) => {
	try {
		const { payoutId } = req.params;

		// Get payout record
		const payoutDoc = await db.collection('payouts').doc(payoutId).get();
		if (!payoutDoc.exists) {
			return res.status(404).json({ error: 'Payout not found' });
		}

		const payoutData = payoutDoc.data();

		if (!payoutData.paypalBatchId) {
			return res.status(400).json({ error: 'No PayPal batch ID found' });
		}

		// Check status with PayPal
		const request = new payoutsSDK.payouts.PayoutsGetRequest(payoutData.paypalBatchId);
		const response = await paypalClient.execute(request);

		const batchStatus = response.result.batch_header.batch_status;
		const payoutItem = response.result.items[0]; // Assuming single item payout

		// Update local record
		const updateData = {
			paypalStatus: batchStatus,
			updatedAt: new Date().toISOString()
		};

		if (payoutItem) {
			updateData.itemStatus = payoutItem.transaction_status;
			updateData.paypalTransactionId = payoutItem.transaction_id;

			// Update our local status based on PayPal status
			if (payoutItem.transaction_status === 'SUCCESS') {
				updateData.status = 'completed';
				updateData.completedAt = new Date().toISOString();
			} else if (payoutItem.transaction_status === 'FAILED' || payoutItem.transaction_status === 'RETURNED') {
				updateData.status = 'failed';
				updateData.failureReason = payoutItem.errors ? payoutItem.errors[0].message : 'Unknown error';
			}
		}

		await db.collection('payouts').doc(payoutId).update(updateData);

		res.json({
			success: true,
			status: updateData.status || 'pending',
			paypalStatus: batchStatus,
			details: response.result
		});

	} catch (error) {
		console.error('Error updating payout status:', error);
		res.status(500).json({ error: 'Failed to update payout status' });
	}
});

// Email template for payout confirmation
const sendPayoutConfirmationEmail = async (userEmail, userName, amount) => {
	try {
		const mailOptions = {
			from: `"MuseCoinX - Hope KK NFTs" <${process.env.EMAIL_USER}>`,
			to: userEmail,
			subject: '🎉 Your Hope KK NFT Payout is Processing!',
			html: `
		<!DOCTYPE html>
		<html>
		<head>
		  <style>
			body {
			  font-family: 'Arial', sans-serif;
			  line-height: 1.6;
			  color: #333;
			  max-width: 600px;
			  margin: 0 auto;
			  padding: 20px;
			  background-color: #f4f4f4;
			}
			.email-container {
			  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			  border-radius: 15px;
			  padding: 30px;
			  box-shadow: 0 10px 25px rgba(0,0,0,0.1);
			}
			.header {
			  text-align: center;
			  color: white;
			  margin-bottom: 30px;
			}
			.content {
			  background: white;
			  padding: 30px;
			  border-radius: 10px;
			  margin: 20px 0;
			  box-shadow: 0 5px 15px rgba(0,0,0,0.1);
			}
			.payout-info {
			  background: #f8f9fa;
			  padding: 20px;
			  border-radius: 8px;
			  margin: 20px 0;
			  border-left: 4px solid #28a745;
			}
			.amount {
			  font-size: 2rem;
			  font-weight: bold;
			  color: #28a745;
			  text-align: center;
			  margin: 20px 0;
			}
		  </style>
		</head>
		<body>
		  <div class="email-container">
			<div class="header">
			  <h1>💰 Payout Processing</h1>
			</div>
			
			<div class="content">
			  <h2>Hello ${userName}! 👋</h2>
			  
			  <p>Great news! Your Hope KK NFT royalty payout is now being processed.</p>
			  
			  <div class="amount">$${amount.toFixed(2)} USD</div>
			  
			  <div class="payout-info">
				<h3>📋 Payout Details:</h3>
				<p><strong>Amount:</strong> $${amount.toFixed(2)} USD</p>
				<p><strong>Status:</strong> Processing</p>
				<p><strong>Estimated Arrival:</strong> 1-3 business days</p>
			  </div>
			  
			  <p>Your payout will be sent to your registered PayPal email address. You'll receive a separate notification from PayPal once the funds are available.</p>
			  
			  <p>Thank you for being part of the Hope KK NFT community!</p>
			</div>
		  </div>
		</body>
		</html>
	  `
		};

		const result = await emailTransporter.sendMail(mailOptions);
		console.log('Payout confirmation email sent:', result.messageId);
		return { success: true, messageId: result.messageId };
	} catch (error) {
		console.error('Error sending payout confirmation email:', error);
		return { success: false, error: error.message };
	}
};

// ============================================
// ADMIN ENDPOINTS FOR PAYOUT MANAGEMENT
// ============================================

// Set total payout pool (admin only)
app.post('/api/admin/set-payout-pool', cors(corsOptions), async (req, res) => {
	try {
		const { totalAmount, adminKey } = req.body;

		// Simple admin authentication - replace with proper auth
		if (adminKey !== process.env.ADMIN_KEY) {
			return res.status(401).json({ error: 'Unauthorized' });
		}

		await db.collection('admin').doc('payoutPool').set({
			totalAmount: parseFloat(totalAmount),
			updatedAt: new Date().toISOString(),
			updatedBy: 'admin'
		});

		res.json({
			success: true,
			message: 'Payout pool updated successfully',
			totalAmount: parseFloat(totalAmount)
		});

	} catch (error) {
		console.error('Error updating payout pool:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

// Get all payouts (admin only)
app.get('/api/admin/payouts', cors(corsOptions), async (req, res) => {
	try {
		const { adminKey } = req.query;

		if (adminKey !== process.env.ADMIN_KEY) {
			return res.status(401).json({ error: 'Unauthorized' });
		}

		const payoutsSnapshot = await db.collection('payouts')
			.orderBy('createdAt', 'desc')
			.get();

		const payouts = [];
		payoutsSnapshot.forEach(doc => {
			payouts.push({ id: doc.id, ...doc.data() });
		});

		res.json({
			success: true,
			payouts: payouts
		});

	} catch (error) {
		console.error('Error fetching admin payouts:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

app.get('/api/test-paypal-connection', cors(corsOptions), async (req, res) => {
	try {
		// Create a simple test request to verify connection
		const request = new paypal.orders.OrdersCreateRequest();
		request.prefer("return=representation");
		request.requestBody({
			intent: 'CAPTURE',
			purchase_units: [{
				amount: {
					currency_code: 'USD',
					value: '1.00'
				}
			}]
		});

		const response = await paypalClient.execute(request);
		console.log('✅ PayPal connection successful!');
		console.log('Order ID:', response.result.id);

		res.json({
			success: true,
			environment: process.env.NODE_ENV === 'production' ? 'Live' : 'Sandbox',
			message: 'PayPal connection successful',
			orderId: response.result.id
		});
	} catch (error) {
		console.error('❌ PayPal connection failed:', error);
		res.status(500).json({
			success: false,
			environment: process.env.NODE_ENV === 'production' ? 'Live' : 'Sandbox',
			message: 'PayPal connection failed',
			error: error.message
		});
	}
});

// Add this endpoint after the existing identity verification endpoint
app.put('/api/admin/paypal/:walletAddress/verify-tax-id', cors(corsOptions), async (req, res) => {
	try {
		const { walletAddress } = req.params;
		const { verified, rejectionReason } = req.body;

		console.log(`🔍 Verifying tax ID document for wallet: ${walletAddress}`, { verified, rejectionReason });

		// Find the document in the paypal collection
		const paypalSnapshot = await db.collection('paypal')
			.where('walletAddress', '==', walletAddress)
			.limit(1)
			.get();

		if (paypalSnapshot.empty) {
			return res.status(404).json({
				error: 'Tax ID document not found for this wallet address'
			});
		}

		const docRef = paypalSnapshot.docs[0].ref;
		const updateData = {
			'taxIdDocument.verified': verified,
			'taxIdDocument.verifiedAt': verified ? new Date().toISOString() : null,
			'taxIdDocument.rejectionReason': verified ? null : rejectionReason,
			'taxIdDocument.rejectedAt': verified ? null : new Date().toISOString(),
			'updatedAt': new Date().toISOString()
		};

		await docRef.update(updateData);

		console.log(`✅ Tax ID document ${verified ? 'approved' : 'rejected'} for wallet: ${walletAddress}`);

		res.json({
			success: true,
			message: verified ? 'Tax ID document approved successfully' : 'Tax ID document rejected successfully',
			verified: verified,
			rejectionReason: rejectionReason || null
		});

	} catch (error) {
		console.error('❌ Error updating tax ID verification status:', error);
		res.status(500).json({
			error: 'Internal server error',
			details: error.message
		});
	}
});

// Test PayPal payout endpoint  
app.post('/api/test-paypal-payout', cors(corsOptions), async (req, res) => {
	try {
		const { recipientEmail, amount } = req.body;

		if (!recipientEmail || !amount) {
			return res.status(400).json({
				error: 'Recipient email and amount are required'
			});
		}

		// Validate amount
		const payoutAmount = parseFloat(amount);
		if (payoutAmount < 1.00 || payoutAmount > 10000) {
			return res.status(400).json({
				error: 'Amount must be between $1.00 and $10,000.00'
			});
		}

		// Create payout request using your existing payoutsSDK
		const payoutId = `test_payout_${Date.now()}`;
		const payoutRequest = new payoutsSDK.payouts.PayoutsPostRequest();

		payoutRequest.requestBody({
			sender_batch_header: {
				sender_batch_id: payoutId,
				email_subject: "Test Payout from Hope KK NFTs",
				email_message: "This is a test payout from the Hope KK NFT system."
			},
			items: [{
				recipient_type: "EMAIL",
				amount: {
					value: payoutAmount.toFixed(2),
					currency: "USD"
				},
				receiver: recipientEmail,
				note: `Test payout - Amount: $${payoutAmount.toFixed(2)}`,
				sender_item_id: payoutId
			}]
		});

		console.log('🚀 Sending test payout...');
		console.log('Recipient:', recipientEmail);
		console.log('Amount:', payoutAmount);

		// Execute the payout using your existing paypalClient
		const response = await paypalClient.execute(payoutRequest);

		console.log('✅ Test payout successful!');
		console.log('Batch ID:', response.result.batch_header.payout_batch_id);
		console.log('Status:', response.result.batch_header.batch_status);

		res.json({
			success: true,
			message: 'Test payout sent successfully!',
			payoutDetails: {
				batchId: response.result.batch_header.payout_batch_id,
				status: response.result.batch_header.batch_status,
				amount: payoutAmount,
				recipient: recipientEmail,
				testPayoutId: payoutId
			}
		});

	} catch (error) {
		console.error('❌ Test payout failed:', error);

		let errorMessage = 'Test payout failed';
		if (error.response && error.response.data) {
			const errorData = error.response.data;
			if (errorData.details && errorData.details.length > 0) {
				errorMessage = errorData.details[0].description || errorMessage;
			}
		}

		res.status(500).json({
			success: false,
			error: errorMessage,
			details: error.message
		});
	}
});

// ADD: Get current payout limits with admin authentication
app.get('/api/admin/payout-limits', authenticateAdmin, async (req, res) => {
	try {
		const limitsDoc = await db.collection('admin_settings').doc('payout_limits').get();

		if (!limitsDoc.exists) {
			return res.json({
				isSet: false,
				totalLimit: 0,
				remainingLimit: 0,
				usedAmount: 0,
				lastReset: null
			});
		}

		const data = limitsDoc.data();
		const remainingLimit = Math.max(0, data.totalLimit - (data.usedAmount || 0));

		res.json({
			isSet: true,
			totalLimit: data.totalLimit || 0,
			remainingLimit: remainingLimit,
			usedAmount: data.usedAmount || 0,
			lastReset: data.lastReset,
			lastUpdated: data.lastUpdated
		});
	} catch (error) {
		console.error('Error fetching payout limits:', error);
		res.status(500).json({ error: 'Failed to fetch payout limits' });
	}
});

app.post('/api/admin/payout-limits', cors(corsOptions), authenticateAdmin, async (req, res) => {
	try {
		const { totalLimit, fromDate, toDate, projectName, comments } = req.body;

		// Validation
		if (!totalLimit || totalLimit <= 0) {
			return res.status(400).json({ error: 'Total limit must be greater than 0' });
		}

		if (totalLimit > 100000) {
			return res.status(400).json({ error: 'Total limit cannot exceed $100,000' });
		}

		// Validate dates if provided
		if (fromDate && toDate) {
			const from = new Date(fromDate);
			const to = new Date(toDate);

			if (from >= to) {
				return res.status(400).json({ error: 'From date must be before To date' });
			}
		}

		const now = new Date();
		const disbursementId = `disbursement_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

		// Get current data for audit log
		const currentDoc = await db.collection('admin_settings').doc('payout_limits').get();
		const oldLimit = currentDoc.exists ? currentDoc.data().totalLimit : null;

		// Mark previous disbursement as inactive
		if (currentDoc.exists) {
			const oldDisbursementId = currentDoc.data().disbursementId;
			if (oldDisbursementId) {
				try {
					const historyQuery = await db.collection('disbursement_history')
						.where('disbursementId', '==', oldDisbursementId)
						.get();

					const batch = db.batch();
					historyQuery.docs.forEach(doc => {
						batch.update(doc.ref, { isActive: false });
					});
					await batch.commit();
				} catch (historyError) {
					console.error('Error updating previous disbursement history:', historyError);
				}
			}
		}

		// Set the new payout limit with disbursement ID
		await db.collection('admin_settings').doc('payout_limits').set({
			totalLimit: parseFloat(totalLimit),
			usedAmount: 0, // Reset used amount when setting new limit
			lastReset: now,
			updatedAt: now,
			updatedBy: 'admin',
			disbursementId: disbursementId, // Track this disbursement
			fromDate: fromDate || null,
			toDate: toDate || null,
			period: (fromDate && toDate) ? `${fromDate} to ${toDate}` : 'Not specified',
			projectName: projectName || null
		});

		// Record this disbursement in history
		await db.collection('disbursement_history').add({
			disbursementId: disbursementId,
			totalLimit: parseFloat(totalLimit),
			fromDate: fromDate || null,
			toDate: toDate || null,
			period: (fromDate && toDate) ? `${fromDate} to ${toDate}` : 'Not specified',
			projectName: projectName || null,
			comments: comments || null,
			usedAmount: 0,
			isActive: true,
			createdAt: now.toISOString(),
			createdBy: 'admin',
			startDate: now.toISOString()
		});

		// Log the change for audit trail
		await db.collection('admin_audit_log').add({
			action: 'payout_limit_updated',
			oldLimit: oldLimit,
			newLimit: parseFloat(totalLimit),
			oldDisbursementId: currentDoc.exists ? currentDoc.data().disbursementId : null,
			newDisbursementId: disbursementId,
			fromDate: fromDate,
			toDate: toDate,
			period: (fromDate && toDate) ? `${fromDate} to ${toDate}` : 'Not specified',
			projectName: projectName,
			timestamp: now,
			adminId: 'admin',
			ip: req.ip
		});

		console.log(`✅ New disbursement created: ${disbursementId} with limit $${totalLimit}`);

		res.json({
			success: true,
			message: 'New disbursement created successfully',
			disbursementId: disbursementId,
			totalLimit: parseFloat(totalLimit),
			remainingLimit: parseFloat(totalLimit)
		});
	} catch (error) {
		console.error('Error setting payout limits:', error);
		res.status(500).json({ error: 'Failed to set payout limits' });
	}
});

app.get('/api/admin/user-withdrawal-breakdown/:walletAddress', cors(corsOptions), authenticateAdmin, async (req, res) => {
	try {
		const walletAddress = req.params.walletAddress;
		const withdrawalData = await getUserWithdrawalsByDisbursement(walletAddress);

		// Get disbursement history for context
		const disbursementHistory = await db.collection('disbursement_history')
			.orderBy('createdAt', 'desc')
			.get();

		const disbursements = [];
		disbursementHistory.forEach(doc => {
			disbursements.push({
				id: doc.id,
				disbursementId: doc.data().disbursementId,
				totalLimit: doc.data().totalLimit,
				period: doc.data().period,
				isActive: doc.data().isActive,
				createdAt: doc.data().createdAt
			});
		});

		res.json({
			success: true,
			walletAddress: walletAddress,
			withdrawalData: withdrawalData,
			disbursementHistory: disbursements
		});

	} catch (error) {
		console.error('Error getting withdrawal breakdown:', error);
		res.status(500).json({ error: 'Failed to get withdrawal breakdown' });
	}
});

// ADD: Reset payout limits (manual reset)
app.post('/api/admin/payout-limits/reset', authenticateAdmin, async (req, res) => {
	try {
		const limitsDoc = await db.collection('admin_settings').doc('payout_limits').get();

		if (!limitsDoc.exists) {
			return res.status(404).json({ error: 'Payout limits not configured' });
		}

		const data = limitsDoc.data();
		const now = new Date();

		await db.collection('admin_settings').doc('payout_limits').update({
			usedAmount: 0,
			lastReset: now,
			updatedAt: now
		});

		// Log the reset
		await db.collection('admin_audit_log').add({
			action: 'payout_limit_reset',
			previousUsedAmount: data.usedAmount,
			timestamp: now,
			adminId: 'admin',
			ip: req.ip
		});

		res.json({
			success: true,
			message: 'Payout limits reset successfully',
			remainingLimit: data.totalLimit
		});
	} catch (error) {
		console.error('Error resetting payout limits:', error);
		res.status(500).json({ error: 'Failed to reset payout limits' });
	}
});

// Admin endpoint to set payout limit
app.post('/api/admin/set-payout-limit', cors(corsOptions), async (req, res) => {
	try {
		const { limitAmount, adminKey } = req.body;

		// Simple admin authentication
		if (adminKey !== process.env.ADMIN_KEY) {
			return res.status(401).json({ error: 'Unauthorized' });
		}

		await db.collection('admin').doc('payoutLimits').set({
			totalLimit: parseFloat(limitAmount),
			remainingLimit: parseFloat(limitAmount), // Initialize remaining with full amount
			updatedAt: new Date().toISOString(),
			updatedBy: 'admin'
		});

		res.json({
			success: true,
			message: 'Payout limit set successfully',
			totalLimit: parseFloat(limitAmount),
			remainingLimit: parseFloat(limitAmount)
		});

	} catch (error) {
		console.error('Error setting payout limit:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

// GET disbursement history with pagination
app.get('/api/admin/disbursement-history', cors(corsOptions), authenticateAdmin, async (req, res) => {
	try {
		const {
			page = 1,
			limit = 10,
			search = ''
		} = req.query;

		console.log('🔍 Fetching disbursement history with filters:', { page, limit, search });

		// Build query
		let query = db.collection('disbursement_history');

		// Apply search filter if provided
		if (search) {
			// Since Firestore doesn't support full-text search, we'll get all and filter in memory
			// For production, consider using Algolia or similar for better search
		}

		// Get all documents (we'll handle pagination in memory for simplicity)
		const snapshot = await query.orderBy('createdAt', 'desc').get();

		let allRecords = [];
		snapshot.forEach(doc => {
			const data = doc.data();
			allRecords.push({
				id: doc.id,
				...data,
				// Ensure createdAt is properly formatted
				createdAt: data.createdAt || new Date().toISOString()
			});
		});

		// Apply search filter in memory
		if (search) {
			const searchLower = search.toLowerCase();
			allRecords = allRecords.filter(record =>
				(record.period && record.period.toLowerCase().includes(searchLower)) ||
				(record.projectName && record.projectName.toLowerCase().includes(searchLower)) ||
				(record.comments && record.comments.toLowerCase().includes(searchLower)) ||
				(record.disbursementId && record.disbursementId.toLowerCase().includes(searchLower))
			);
		}

		// Calculate statistics
		const stats = {
			totalDisbursements: allRecords.length,
			totalAmountDisbursed: allRecords.reduce((sum, record) => sum + (record.totalLimit || 0), 0),
			totalAmountUsed: allRecords.reduce((sum, record) => sum + (record.usedAmount || 0), 0),
			activeDisbursements: allRecords.filter(record => record.isActive).length
		};

		// Apply pagination
		const totalRecords = allRecords.length;
		const totalPages = Math.ceil(totalRecords / parseInt(limit));
		const startIndex = (parseInt(page) - 1) * parseInt(limit);
		const endIndex = startIndex + parseInt(limit);

		const paginatedRecords = allRecords.slice(startIndex, endIndex);

		// Pagination info
		const pagination = {
			currentPage: parseInt(page),
			totalPages,
			totalRecords,
			hasNextPage: parseInt(page) < totalPages,
			hasPrevPage: parseInt(page) > 1
		};

		console.log(`✅ Returning ${paginatedRecords.length} of ${totalRecords} disbursement records (page ${page}/${totalPages})`);

		res.json({
			success: true,
			records: paginatedRecords,
			pagination,
			stats,
			filters: { search }
		});

	} catch (error) {
		console.error('❌ Error fetching disbursement history:', error);
		res.status(500).json({
			success: false,
			error: 'Internal server error',
			details: error.message
		});
	}
});


/*ARTIST DAPP SERVER STARTS*/

app.post('/api/artists/register', cors(corsOptions), async (req, res) => {
	try {
		const { name, email, mobile, password } = req.body;

		// Enhanced validation
		if (!name || !email || !mobile || !password) {
			return res.status(400).json({
				error: 'All fields are required',
				missingFields: {
					name: !name,
					email: !email,
					mobile: !mobile,
					password: !password
				}
			});
		}

		// Validate name length
		if (name.length > 15) {
			return res.status(400).json({
				error: 'Name must be 15 characters or less'
			});
		}

		if (name.length < 2) {
			return res.status(400).json({
				error: 'Name must be at least 2 characters'
			});
		}

		// Validate email format
		const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
		if (!emailRegex.test(email)) {
			return res.status(400).json({
				error: 'Please enter a valid email address (e.g., user@gmail.com)'
			});
		}

		// Validate password length
		if (password.length < 6) {
			return res.status(400).json({
				error: 'Password must be at least 6 characters long'
			});
		}

		// Validate mobile number
		if (!mobile || mobile.length < 10) {
			return res.status(400).json({
				error: 'Please enter a valid mobile number'
			});
		}

		console.log('🔍 Artist registration attempt:', {
			name: name.trim(),
			email: email.toLowerCase().trim(),
			mobile: mobile
		});

		// Check if artist already exists
		const existingArtist = await db.collection('artists')
			.where('email', '==', email.toLowerCase().trim())
			.limit(1)
			.get();

		if (!existingArtist.empty) {
			console.log('❌ Artist already exists:', email);
			return res.status(409).json({
				error: 'An account with this email already exists. Please try logging in instead.'
			});
		}

		// Create artist data - INCLUDING NAME
		const artistData = {
			name: name.trim(), // ✅ FIXED: Added name field
			email: email.toLowerCase().trim(),
			mobile: mobile.trim(),
			password: password, // Note: In production, hash this password
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		};

		console.log('💾 Saving artist data:', artistData);

		// Save to Firebase
		const docRef = await db.collection('artists').add(artistData);

		console.log('✅ Artist registered successfully:', {
			id: docRef.id,
			name: artistData.name,
			email: artistData.email
		});

		res.status(201).json({
			success: true,
			message: 'Artist registered successfully! You can now log in.',
			artistId: docRef.id,
			name: artistData.name
		});

	} catch (error) {
		console.error('❌ Error registering artist:', error);
		res.status(500).json({
			error: 'Registration failed. Please try again.',
			details: process.env.NODE_ENV === 'development' ? error.message : undefined
		});
	}
});

app.post('/api/artists/login', cors(corsOptions), async (req, res) => {
	try {
		const { email, password } = req.body;

		if (!email || !password) {
			return res.status(400).json({
				error: 'Email and password are required'
			});
		}

		// Validate email format
		const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
		if (!emailRegex.test(email)) {
			return res.status(400).json({
				error: 'Please enter a valid email address'
			});
		}

		console.log('🔍 Login attempt for:', email.toLowerCase().trim());

		// Find artist - search by email and password
		const artistQuery = await db.collection('artists')
			.where('email', '==', email.toLowerCase().trim())
			.where('password', '==', password)
			.limit(1)
			.get();

		if (artistQuery.empty) {
			console.log('❌ Login failed - invalid credentials for:', email);
			return res.status(401).json({
				error: 'Invalid email or password. Please check your credentials and try again.'
			});
		}

		const artistDoc = artistQuery.docs[0];
		const artistData = artistDoc.data();

		// Update last login time
		await artistDoc.ref.update({
			lastLoginAt: new Date().toISOString()
		});

		console.log('✅ Login successful for:', {
			id: artistDoc.id,
			name: artistData.name,
			email: artistData.email
		});

		// Return artist data - INCLUDING NAME
		res.json({
			success: true,
			message: 'Login successful',
			artist: {
				id: artistDoc.id,
				name: artistData.name || 'Artist', // ✅ FIXED: Include name field
				email: artistData.email,
				mobile: artistData.mobile,
				createdAt: artistData.createdAt,
				lastLoginAt: new Date().toISOString()
			}
		});

	} catch (error) {
		console.error('❌ Error during login:', error);
		res.status(500).json({
			error: 'Login failed. Please try again.',
			details: process.env.NODE_ENV === 'development' ? error.message : undefined
		});
	}
});

app.post('/api/artists/create-project', cors(corsOptions), async (req, res) => {
	let tempImagePath = null;

	try {
		const { artistId, projectName, projectSymbol, totalSupply, mintPrice, contractOwner, image } = req.body;

		console.log('🎨 Creating project for artist:', artistId);
		console.log('📊 Project details:', {
			projectName,
			projectSymbol,
			totalSupply,
			mintPrice,
			contractOwner,
			hasImage: !!image
		});

		// Enhanced validation with specific error messages
		const missingFields = {};
		if (!artistId) missingFields.artistId = true;
		if (!projectName || !projectName.trim()) missingFields.projectName = true;
		if (!projectSymbol || !projectSymbol.trim()) missingFields.projectSymbol = true;
		if (!totalSupply) missingFields.totalSupply = true;
		if (mintPrice === undefined || mintPrice === null || mintPrice === '') missingFields.mintPrice = true;
		if (!contractOwner || !contractOwner.trim()) missingFields.contractOwner = true;
		if (!image) missingFields.image = true;

		if (Object.keys(missingFields).length > 0) {
			return res.status(400).json({
				error: 'All fields are required',
				missingFields: missingFields
			});
		}

		// Validate project name
		if (projectName.trim().length < 2) {
			return res.status(400).json({
				error: 'Project name must be at least 2 characters long'
			});
		}

		if (projectName.trim().length > 50) {
			return res.status(400).json({
				error: 'Project name must be 50 characters or less'
			});
		}

		// Validate project symbol
		if (projectSymbol.trim().length < 1) {
			return res.status(400).json({
				error: 'Project symbol is required'
			});
		}

		if (projectSymbol.trim().length > 10) {
			return res.status(400).json({
				error: 'Project symbol must be 10 characters or less'
			});
		}

		// Validate total supply
		const supply = parseInt(totalSupply);
		if (isNaN(supply) || supply < 1) {
			return res.status(400).json({
				error: 'Total supply must be at least 1'
			});
		}

		if (supply > 1000000) {
			return res.status(400).json({
				error: 'Total supply cannot exceed 1,000,000'
			});
		}

		// Validate mint price
		const price = parseFloat(mintPrice);
		if (isNaN(price) || price < 0) {
			return res.status(400).json({
				error: 'Mint price cannot be negative'
			});
		}

		if (price > 10000) {
			return res.status(400).json({
				error: 'Mint price cannot exceed $10,000'
			});
		}

		// Validate contract owner address
		const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
		if (!ethAddressRegex.test(contractOwner.trim())) {
			return res.status(400).json({
				error: 'Invalid contract owner address format. Must be a valid Ethereum address (0x followed by 40 hex characters).'
			});
		}

		const artistDoc = await db.collection('artists').doc(artistId).get();
		if (!artistDoc.exists) {
			console.log('❌ Artist not found:', artistId);
			return res.status(404).json({
				error: 'Artist account not found. Please log in again.'
			});
		}

		const artistData = artistDoc.data();
		console.log('✅ Artist found:', {
			name: artistData.name,
			email: artistData.email
		});

		// Check for duplicate project symbol
		const existingSymbol = await db.collection('artist_projects')
			.where('projectSymbol', '==', projectSymbol.trim().toUpperCase())
			.limit(1)
			.get();

		if (!existingSymbol.empty) {
			console.log('❌ Duplicate project symbol:', projectSymbol);
			return res.status(409).json({
				error: `Project symbol "${projectSymbol.trim().toUpperCase()}" already exists. Please choose a different symbol.`
			});
		}

		// NEW: Check for duplicate project name
		const existingName = await db.collection('artist_projects')
			.where('projectName', '==', projectName.trim())
			.limit(1)
			.get();

		if (!existingName.empty) {
			console.log('❌ Duplicate project name:', projectName);
			return res.status(409).json({
				error: `Project name "${projectName.trim()}" already exists. Please choose a different name.`
			});
		}

		// Process and upload image to IPFS
		let imageIpfsData = null;
		if (image) {
			try {
				console.log('📸 Processing project image...');

				// Remove data URL prefix if present
				const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '');
				let imageBuffer = Buffer.from(base64Data, 'base64');

				// Validate image size (10MB limit)
				if (imageBuffer.length > 10 * 1024 * 1024) {
					return res.status(400).json({
						error: 'Image size must be less than 10MB'
					});
				}

				// Compress image if it's larger than 1MB
				if (imageBuffer.length > 1 * 1024 * 1024) {
					console.log('🔄 Compressing large image...');
					imageBuffer = await compressImage(imageBuffer);
					console.log(`✅ Image compressed to ${(imageBuffer.length / 1024 / 1024).toFixed(2)}MB`);
				}

				// Generate unique filename
				const fileName = `artist_project_${artistId}_${Date.now()}.jpg`;

				// Upload to IPFS with improved function
				imageIpfsData = await uploadToIPFSFromBuffer(imageBuffer, fileName, 3);

				console.log('✅ Project image uploaded to IPFS:', imageIpfsData.ipfsUrl);
			} catch (ipfsError) {
				console.error('❌ IPFS upload failed:', ipfsError);
				return res.status(500).json({
					error: 'Failed to upload image. Please try again with a smaller image or different format.'
				});
			}
		}

		// Create project data with contract owner
		const projectData = {
			artistId: artistId,
			artistName: artistData.name,
			artistEmail: artistData.email,
			projectName: projectName.trim(),
			projectSymbol: projectSymbol.trim().toUpperCase(),
			totalSupply: supply,
			mintPrice: price,
			contractOwner: contractOwner.trim(),
			imageIpfsUrl: imageIpfsData?.ipfsUrl || null,
			imageIpfsHash: imageIpfsData?.ipfsHash || null,
			status: 'pending',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		};

		// Save to Firebase
		const projectRef = await db.collection('artist_projects').add(projectData);

		console.log('✅ New artist project created successfully:', {
			projectId: projectRef.id,
			artistName: artistData.name,
			artistEmail: artistData.email,
			projectName: projectName.trim(),
			projectSymbol: projectSymbol.trim().toUpperCase(),
			contractOwner: contractOwner.trim(),
			ipfsUrl: imageIpfsData?.ipfsUrl
		});

		res.status(201).json({
			success: true,
			message: 'Project created successfully and is pending approval',
			project: {
				id: projectRef.id,
				...projectData
			}
		});

	} catch (error) {
		console.error('❌ Error creating project:', error);

		// Clean up temporary file if it exists
		if (tempImagePath && fs.existsSync(tempImagePath)) {
			fs.unlinkSync(tempImagePath);
		}

		res.status(500).json({
			error: 'Failed to create project. Please try again.',
			details: process.env.NODE_ENV === 'development' ? error.message : undefined
		});
	}
});

app.get('/api/artists/:artistId/projects', cors(corsOptions), async (req, res) => {
	try {
		const { artistId } = req.params;

		console.log(`📋 Fetching projects for artist: ${artistId}`);

		const artistDoc = await db.collection('artists').doc(artistId).get();
		if (!artistDoc.exists) {
			return res.status(404).json({ error: 'Artist not found' });
		}

		let query = db.collection('artist_projects')
			.where('artistId', '==', artistId);

		const projectsSnapshot = await query.get();

		const projects = [];
		projectsSnapshot.forEach(doc => {
			const projectData = doc.data();
			// ADD THIS LOG to see what's being returned
			console.log(`Project: ${projectData.projectName}, ArtistId: ${projectData.artistId}, Expected: ${artistId}`);

			projects.push({
				id: doc.id,
				...projectData
			});
		});

		projects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

		console.log(`✅ Found ${projects.length} projects for artist ${artistId}`);

		res.json({
			success: true,
			projects: projects
		});

	} catch (error) {
		console.error('❌ Error fetching projects:', error);
		res.status(500).json({ error: 'Failed to fetch projects' });
	}
});

// Update project (with IPFS image update support)
app.put('/api/artists/projects/:projectId', cors(corsOptions), async (req, res) => {
	try {
		const { projectId } = req.params;
		const { projectName, projectSymbol, totalSupply, mintPrice, artistId, image } = req.body;

		// Get existing project
		const projectDoc = await db.collection('artist_projects').doc(projectId).get();
		if (!projectDoc.exists) {
			return res.status(404).json({ error: 'Project not found' });
		}

		const existingData = projectDoc.data();

		// Verify artist owns this project
		if (existingData.artistId !== artistId) {
			return res.status(403).json({ error: 'Access denied' });
		}

		// Prepare update data
		const updateData = {
			updatedAt: new Date().toISOString()
		};

		if (projectName) updateData.projectName = projectName.trim();
		if (projectSymbol) updateData.projectSymbol = projectSymbol.trim().toUpperCase();
		if (totalSupply) updateData.totalSupply = parseInt(totalSupply);
		if (mintPrice) updateData.mintPrice = parseFloat(mintPrice);

		// Handle image update
		if (image) {
			try {
				// Remove data URL prefix if present
				const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '');
				const imageBuffer = Buffer.from(base64Data, 'base64');

				// Generate unique filename
				const fileName = `artist_project_update_${artistId}_${Date.now()}.jpg`;

				// Upload new image to IPFS
				const imageIpfsData = await uploadToIPFSFromBuffer(imageBuffer, fileName);

				// Update with new IPFS data
				updateData.imageIpfsUrl = imageIpfsData.ipfsUrl;
				updateData.imageIpfsHash = imageIpfsData.ipfsHash;

				console.log('Project image updated on IPFS:', imageIpfsData.ipfsUrl);
			} catch (ipfsError) {
				console.error('IPFS upload failed during update:', ipfsError);
				return res.status(500).json({ error: 'Failed to upload updated image to IPFS' });
			}
		}

		// Update in database
		await db.collection('artist_projects').doc(projectId).update(updateData);

		res.json({
			success: true,
			message: 'Project updated successfully',
			project: {
				id: projectId,
				...existingData,
				...updateData
			}
		});

	} catch (error) {
		console.error('❌ Error updating project:', error);
		res.status(500).json({ error: 'Failed to update project' });
	}
});

// Delete project
app.delete('/api/artists/projects/:projectId', cors(corsOptions), async (req, res) => {
	try {
		const { projectId } = req.params;
		const { artistId } = req.body;

		// Get project
		const projectDoc = await db.collection('artist_projects').doc(projectId).get();
		if (!projectDoc.exists) {
			return res.status(404).json({ error: 'Project not found' });
		}

		const projectData = projectDoc.data();

		// Verify artist owns this project
		if (projectData.artistId !== artistId) {
			return res.status(403).json({ error: 'Access denied' });
		}

		// Delete from database (IPFS files remain on IPFS network)
		await db.collection('artist_projects').doc(projectId).delete();

		console.log('🗑️ Deleted project:', projectId, 'IPFS URL:', projectData.imageIpfsUrl);

		res.json({
			success: true,
			message: 'Project deleted successfully'
		});

	} catch (error) {
		console.error('❌ Error deleting project:', error);
		res.status(500).json({ error: 'Failed to delete project' });
	}
});

// Admin endpoints for project management
app.get('/api/admin/artist-projects', cors(corsOptions), async (req, res) => {
	try {
		const { status = 'all', limit = 10, page = 1, search = '' } = req.query;

		console.log('🔍 Fetching admin artist projects:', { status, limit, page, search });

		// Get ALL projects first (without filtering by status initially)
		let query = db.collection('artist_projects')
			.orderBy('createdAt', 'desc');

		const snapshot = await query.get();

		let projects = [];
		snapshot.forEach(doc => {
			projects.push({
				id: doc.id,
				...doc.data()
			});
		});

		// Apply status filter in memory
		if (status && status !== 'all' && status !== '') {
			console.log('🔍 Filtering by status:', status);
			projects = projects.filter(project => project.status === status);
		}

		// Apply search filter if provided
		if (search && search.trim() !== '') {
			const searchLower = search.toLowerCase().trim();
			console.log('🔍 Filtering by search:', searchLower);
			projects = projects.filter(project =>
				project.projectName?.toLowerCase().includes(searchLower) ||
				project.projectSymbol?.toLowerCase().includes(searchLower) ||
				project.artistName?.toLowerCase().includes(searchLower) ||
				project.artistEmail?.toLowerCase().includes(searchLower)
			);
		}

		// Calculate pagination
		const total = projects.length;
		const limitNum = parseInt(limit) || 10;
		const pageNum = parseInt(page) || 1;
		const startIndex = (pageNum - 1) * limitNum;
		const endIndex = startIndex + limitNum;
		const paginatedProjects = projects.slice(startIndex, endIndex);

		// Calculate stats
		const allProjects = projects; // Keep reference to all projects for stats
		const stats = {
			total: allProjects.length,
			pending: allProjects.filter(p => p.status === 'pending').length,
			approved: allProjects.filter(p => p.status === 'approved').length,
			rejected: allProjects.filter(p => p.status === 'rejected').length
		};

		console.log('✅ Sending response:', {
			projectsCount: paginatedProjects.length,
			totalProjects: total,
			stats: stats
		});

		res.json({
			success: true,
			projects: paginatedProjects,
			stats: stats,
			pagination: {
				page: pageNum,
				limit: limitNum,
				total: total,
				totalPages: Math.ceil(total / limitNum)
			}
		});

	} catch (error) {
		console.error('❌ Error fetching admin projects:', error);
		res.status(500).json({
			error: 'Failed to fetch projects',
			details: process.env.NODE_ENV === 'development' ? error.message : undefined
		});
	}
});

// Admin approve/reject project
app.put('/api/admin/artist-projects/:projectId/status', cors(corsOptions), async (req, res) => {
	try {
		const { projectId } = req.params;
		const { status, rejectionReason } = req.body;

		if (!['approved', 'rejected'].includes(status)) {
			return res.status(400).json({ error: 'Invalid status. Must be approved or rejected.' });
		}

		const updateData = {
			status: status,
			updatedAt: new Date().toISOString(),
			reviewedAt: new Date().toISOString()
		};

		if (status === 'rejected' && rejectionReason) {
			updateData.rejectionReason = rejectionReason;
		}

		await db.collection('artist_projects').doc(projectId).update(updateData);

		res.json({
			success: true,
			message: `Project ${status} successfully`,
			status: status
		});

	} catch (error) {
		console.error('❌ Error updating project status:', error);
		res.status(500).json({ error: 'Failed to update project status' });
	}
});

// Get project by artist name and project name
app.get('/api/public/projects/:artistName/:projectName', cors(corsOptions), async (req, res) => {
    try {
        const { artistName, projectName } = req.params;
        
        // Decode URL-encoded names
        const decodedArtistName = decodeURIComponent(artistName).toLowerCase();
        const decodedProjectName = decodeURIComponent(projectName).toLowerCase();
        
        console.log(`🔍 Fetching project: ${decodedArtistName}/${decodedProjectName}`);
        
        // Get all projects and filter in memory (case-insensitive)
        const allProjectsSnapshot = await db.collection('artist_projects').get();
        
        let foundProject = null;
        let foundProjectId = null;
        
        allProjectsSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.artistName && data.projectName) {
                if (data.artistName.toLowerCase() === decodedArtistName && 
                    data.projectName.toLowerCase() === decodedProjectName) {
                    foundProject = data;
                    foundProjectId = doc.id;
                }
            }
        });
        
        if (!foundProject) {
            console.log('❌ Project not found');
            return res.status(404).json({ 
                error: 'Project not found' 
            });
        }
        
        console.log('✅ Project found:', foundProject.projectName);
        
        res.json({
            success: true,
            project: {
                id: foundProjectId,
                ...foundProject
            }
        });
        
    } catch (error) {
        console.error('❌ Error fetching project:', error);
        res.status(500).json({ 
            error: 'Failed to fetch project',
            details: error.message
        });
    }
});

// Get all projects by artist name
app.get('/api/public/artists/:artistName/projects', cors(corsOptions), async (req, res) => {
    try {
        const { artistName } = req.params;
        
        console.log(`🔍 Fetching projects for artist: ${artistName}`);
        
        const projectsSnapshot = await db.collection('artist_projects')
            .where('artistName', '==', artistName)
            .where('status', '==', 'approved')
            .get();
        
        const projects = [];
        projectsSnapshot.forEach(doc => {
            projects.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Sort by creation date
        projects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        res.json({
            success: true,
            projects: projects
        });
        
    } catch (error) {
        console.error('❌ Error fetching artist projects:', error);
        res.status(500).json({ 
            error: 'Failed to fetch projects',
            details: error.message
        });
    }
});
// ============================================
// FIXED PUBLIC PROJECT PAGE ENDPOINTS
// ============================================

app.post('/api/artists/verify-ownership', cors(corsOptions), async (req, res) => {
    try {
        const { artistId, projectName } = req.body;

        if (!artistId || !projectName) {
            return res.status(400).json({
                error: 'Artist ID and project name are required'
            });
        }

        console.log(`🔍 Verifying ownership for artist ${artistId} and project ${projectName}`);

        // Get artist data
        const artistDoc = await db.collection('artists').doc(artistId).get();
        
        if (!artistDoc.exists) {
            return res.status(404).json({
                error: 'Artist not found',
                isOwner: false
            });
        }

        const artistData = artistDoc.data();

        // Find project by artistId and projectName (case-insensitive)
        const allProjectsSnapshot = await db.collection('artist_projects')
            .where('artistId', '==', artistId)
            .get();

        let foundProject = null;
        let foundProjectId = null;

        allProjectsSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.projectName && 
                data.projectName.toLowerCase() === projectName.toLowerCase()) {
                foundProject = data;
                foundProjectId = doc.id;
            }
        });

        if (!foundProject) {
            return res.json({
                isOwner: false,
                message: 'Project not found'
            });
        }

        // Check if the artistId matches
        const isOwner = foundProject.artistId === artistId;

        console.log(`✅ Ownership verified: ${isOwner}`);

        res.json({
            isOwner: isOwner,
            projectId: foundProjectId,
            project: {
                ...foundProject,
                id: foundProjectId
            }
        });

    } catch (error) {
        console.error('❌ Error verifying ownership:', error);
        res.status(500).json({
            error: 'Failed to verify ownership',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

app.put('/api/artists/projects/:projectId/details', cors(corsOptions), async (req, res) => {
    try {
        const { projectId } = req.params;
        const { artistId, description, coverImage, backgroundColor } = req.body;

        console.log(`🔧 Updating project details for: ${projectId}`);

        // Get project
        const projectDoc = await db.collection('artist_projects').doc(projectId).get();
        
        if (!projectDoc.exists) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const projectData = projectDoc.data();

        // Verify artist owns this project
        if (projectData.artistId !== artistId) {
            return res.status(403).json({ 
                error: 'Access denied. You do not own this project.' 
            });
        }

        // Prepare update data
        const updateData = {
            updatedAt: new Date().toISOString()
        };

        // Update description if provided
        if (description !== undefined) {
            updateData.description = description.trim();
        }

        // Update background color if provided
        if (backgroundColor !== undefined && backgroundColor.trim()) {
            updateData.backgroundColor = backgroundColor.trim();
            console.log('✅ Background color updated:', backgroundColor.trim());
        }

        // Handle cover image upload to IPFS if provided
        if (coverImage) {
            try {
                console.log('📸 Processing cover image...');

                const base64Data = coverImage.replace(/^data:image\/[a-z]+;base64,/, '');
                let imageBuffer = Buffer.from(base64Data, 'base64');

                if (imageBuffer.length > 1 * 1024 * 1024) {
                    return res.status(400).json({
                        error: 'Cover image size must be less than 1MB'
                    });
                }

                if (imageBuffer.length > 500 * 1024) {
                    console.log('🔄 Compressing cover image...');
                    imageBuffer = await compressImage(imageBuffer);
                    console.log(`✅ Image compressed to ${(imageBuffer.length / 1024).toFixed(2)}KB`);
                }

                const fileName = `project_cover_${artistId}_${Date.now()}.jpg`;
                const coverIpfsData = await uploadToIPFSFromBuffer(imageBuffer, fileName, 3);

                updateData.coverImageIpfsUrl = coverIpfsData.ipfsUrl;
                updateData.coverImageIpfsHash = coverIpfsData.ipfsHash;

                console.log('✅ Cover image uploaded to IPFS:', coverIpfsData.ipfsUrl);
            } catch (ipfsError) {
                console.error('❌ IPFS upload failed:', ipfsError);
                return res.status(500).json({
                    error: 'Failed to upload cover image. Please try again with a smaller image.'
                });
            }
        }

        // Update in database
        await db.collection('artist_projects').doc(projectId).update(updateData);

        console.log(`✅ Project details updated successfully for: ${projectData.projectName}`);

        res.json({
            success: true,
            message: 'Project details updated successfully',
            project: {
                id: projectId,
                ...projectData,
                ...updateData
            }
        });

    } catch (error) {
        console.error('❌ Error updating project details:', error);
        res.status(500).json({
            error: 'Failed to update project details',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get single project by ID - FIXED
app.get('/api/public/projects/:projectId', cors(corsOptions), async (req, res) => {
	try {
		const { projectId } = req.params;
		
		console.log(`🌐 Fetching public project: ${projectId}`);
		
		const projectDoc = await db.collection('artist_projects').doc(projectId).get();
		
		if (!projectDoc.exists) {
			console.log('❌ Project not found:', projectId);
			return res.status(404).json({ 
				error: 'Project not found' 
			});
		}
		
		const projectData = projectDoc.data();
		console.log('✅ Project found:', projectData.projectName);
		
		res.json({
			success: true,
			project: {
				id: projectDoc.id,
				projectName: projectData.projectName,
				projectSymbol: projectData.projectSymbol,
				artistName: projectData.artistName,
				artistEmail: projectData.artistEmail,
				artistId: projectData.artistId,
				totalSupply: projectData.totalSupply,
				mintPrice: projectData.mintPrice,
				imageIpfsUrl: projectData.imageIpfsUrl,
				imageIpfsHash: projectData.imageIpfsHash,
				status: projectData.status,
				contractAddress: projectData.contractAddress || null,
				networkId: projectData.networkId || null,
				mintingEnabled: projectData.mintingEnabled || false,
				createdAt: projectData.createdAt,
				updatedAt: projectData.updatedAt,
				rejectionReason: projectData.rejectionReason || null
			}
		});
		
	} catch (error) {
		console.error('❌ Error fetching public project:', error);
		res.status(500).json({ 
			error: 'Failed to fetch project',
			details: error.message
		});
	}
});

// Get all approved projects - FIXED VERSION
app.get('/api/public/projects', cors(corsOptions), async (req, res) => {
	try {
		const { limit = 20, page = 1 } = req.query;
		
		console.log('🌐 Fetching all projects from artist_projects collection');
		
		// FIXED: Get ALL documents first, then filter in memory
		const snapshot = await db.collection('artist_projects').get();
		
		console.log(`📊 Found ${snapshot.size} total documents`);
		
		const allProjects = [];
		snapshot.forEach(doc => {
			const data = doc.data();
			console.log(`📄 Project: ${data.projectName}, Status: ${data.status}`);
			allProjects.push({
				id: doc.id,
				projectName: data.projectName,
				projectSymbol: data.projectSymbol,
				artistName: data.artistName,
				totalSupply: data.totalSupply,
				mintPrice: data.mintPrice,
				imageIpfsUrl: data.imageIpfsUrl,
				contractAddress: data.contractAddress || null,
				mintingEnabled: data.mintingEnabled || false,
				status: data.status,
				createdAt: data.createdAt
			});
		});
		
		// Filter approved projects in memory
		const approvedProjects = allProjects.filter(p => p.status === 'approved');
		
		console.log(`✅ Found ${approvedProjects.length} approved projects out of ${allProjects.length} total`);
		
		// Sort by creation date (newest first)
		approvedProjects.sort((a, b) => {
			const dateA = new Date(a.createdAt || 0);
			const dateB = new Date(b.createdAt || 0);
			return dateB - dateA;
		});
		
		// Pagination
		const limitNum = parseInt(limit);
		const pageNum = parseInt(page);
		const startIndex = (pageNum - 1) * limitNum;
		const endIndex = startIndex + limitNum;
		const paginatedProjects = approvedProjects.slice(startIndex, endIndex);
		
		res.json({
			success: true,
			projects: paginatedProjects,
			pagination: {
				page: pageNum,
				limit: limitNum,
				total: approvedProjects.length,
				totalPages: Math.ceil(approvedProjects.length / limitNum)
			}
		});
		
	} catch (error) {
		console.error('❌ Error fetching public projects:', error);
		console.error('Error details:', error.message);
		console.error('Error stack:', error.stack);
		res.status(500).json({ 
			error: 'Failed to fetch projects',
			details: error.message
		});
	}
});

// ============================================
// ADMIN CONTRACT MANAGEMENT ENDPOINTS - FIXED
// ============================================

// Update contract details - FIXED
// Update contract details - FIXED TO APPROVE AND ADD CONTRACT AT SAME TIME
app.put('/api/admin/artist-projects/:projectId/contract', cors(corsOptions), async (req, res) => {
	try {
		const { projectId } = req.params;
		const { contractAddress, networkId, mintingEnabled } = req.body;
		
		console.log(`🔧 Approving and updating contract for project: ${projectId}`);
		console.log('Contract data:', { contractAddress, networkId, mintingEnabled });
		
		// Validate contract address format
		if (contractAddress && !/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
			return res.status(400).json({ 
				error: 'Invalid contract address format. Must be 0x followed by 40 hex characters.' 
			});
		}
		
		// Get project
		const projectDoc = await db.collection('artist_projects').doc(projectId).get();
		
		if (!projectDoc.exists) {
			return res.status(404).json({ 
				error: 'Project not found' 
			});
		}
		
		const projectData = projectDoc.data();
		
		// REMOVED: Status check - we now approve AND add contract at the same time
		
		// Prepare update data - APPROVE + ADD CONTRACT
		const updateData = {
			status: 'approved', // ✅ APPROVE THE PROJECT
			contractAddress: contractAddress.toLowerCase().trim(),
			networkId: networkId || '137',
			mintingEnabled: mintingEnabled !== false, // Default to true
			contractAddedAt: new Date().toISOString(),
			reviewedAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		};
		
		// Update in database
		await db.collection('artist_projects').doc(projectId).update(updateData);
		
		console.log(`✅ Project APPROVED and contract added successfully for: ${projectData.projectName}`);
		
		res.json({
			success: true,
			message: 'Project approved and contract details added successfully',
			project: {
				id: projectId,
				...projectData,
				...updateData
			}
		});
		
	} catch (error) {
		console.error('❌ Error approving and updating contract:', error);
		res.status(500).json({ 
			error: 'Failed to approve project and update contract details',
			details: error.message
		});
	}
});

// Toggle minting status - FIXED
app.patch('/api/admin/artist-projects/:projectId/toggle-minting', cors(corsOptions), async (req, res) => {
	try {
		const { projectId } = req.params;
		const { mintingEnabled } = req.body;
		
		console.log(`🎯 Toggling minting for project: ${projectId} to ${mintingEnabled}`);
		
		const projectDoc = await db.collection('artist_projects').doc(projectId).get();
		
		if (!projectDoc.exists) {
			return res.status(404).json({ 
				error: 'Project not found' 
			});
		}
		
		const projectData = projectDoc.data();
		
		// Validate project has contract
		if (!projectData.contractAddress) {
			return res.status(400).json({ 
				error: 'Cannot enable minting without contract address. Please add contract details first.' 
			});
		}
		
		// Update minting status
		await db.collection('artist_projects').doc(projectId).update({
			mintingEnabled: mintingEnabled,
			mintingToggledAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		});
		
		console.log(`✅ Minting ${mintingEnabled ? 'enabled' : 'disabled'} for: ${projectData.projectName}`);
		
		res.json({
			success: true,
			message: `Minting ${mintingEnabled ? 'enabled' : 'disabled'} successfully`,
			mintingEnabled: mintingEnabled
		});
		
	} catch (error) {
		console.error('❌ Error toggling minting:', error);
		res.status(500).json({ 
			error: 'Failed to toggle minting status',
			details: error.message
		});
	}
});

// DEBUG ENDPOINT - Test database connection
app.get('/api/debug/artist-projects', cors(corsOptions), async (req, res) => {
	try {
		console.log('🔍 DEBUG: Testing artist_projects collection');
		
		const snapshot = await db.collection('artist_projects').get();
		
		const projects = [];
		snapshot.forEach(doc => {
			projects.push({
				id: doc.id,
				data: doc.data()
			});
		});
		
		console.log(`✅ DEBUG: Found ${projects.length} projects`);
		
		res.json({
			success: true,
			count: projects.length,
			projects: projects
		});
		
	} catch (error) {
		console.error('❌ DEBUG ERROR:', error);
		res.status(500).json({ 
			error: 'Debug failed',
			details: error.message
		});
	}
});

// Add this endpoint for real-time project name checking
app.post('/api/artists/check-project-name', cors(corsOptions), async (req, res) => {
    try {
        const { projectName, artistId } = req.body;

        if (!projectName || !projectName.trim()) {
            return res.status(400).json({
                error: 'Project name is required'
            });
        }

        if (!artistId) {
            return res.status(400).json({
                error: 'Artist ID is required'
            });
        }

        // Check if project name already exists
        const existingProject = await db.collection('artist_projects')
            .where('projectName', '==', projectName.trim())
            .limit(1)
            .get();

        res.json({
            available: existingProject.empty,
            projectName: projectName.trim()
        });

    } catch (error) {
        console.error('❌ Error checking project name:', error);
        res.status(500).json({
            error: 'Failed to check project name availability'
        });
    }
});

// Add this endpoint for real-time project symbol availability checking
app.post('/api/artists/check-project-symbol', cors(corsOptions), async (req, res) => {
    try {
        const { projectSymbol, artistId } = req.body;

        if (!projectSymbol || !projectSymbol.trim()) {
            return res.status(400).json({
                error: 'Project symbol is required'
            });
        }

        if (!artistId) {
            return res.status(400).json({
                error: 'Artist ID is required'
            });
        }

        console.log('🔍 Checking project symbol availability:', projectSymbol.trim().toUpperCase());

        // Check if project symbol already exists
        const existingProject = await db.collection('artist_projects')
            .where('projectSymbol', '==', projectSymbol.trim().toUpperCase())
            .limit(1)
            .get();

        const available = existingProject.empty;
        
        console.log(`✅ Project symbol "${projectSymbol.trim().toUpperCase()}" is ${available ? 'available' : 'taken'}`);

        res.json({
            available: available,
            projectSymbol: projectSymbol.trim().toUpperCase()
        });

    } catch (error) {
        console.error('❌ Error checking project symbol:', error);
        res.status(500).json({
            error: 'Failed to check project symbol availability',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/*ARTIST DAPP SERVER ENDS*/


module.exports = {
	calculateUserPayout,
	getTotalPayoutPool,
	getUserPayoutHistory,
	sendPayoutConfirmationEmail
};

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});
