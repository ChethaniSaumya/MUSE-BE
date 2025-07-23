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
	origin: ['https://muse-fe.vercel.app', 'http://localhost:3000', 'http://localhost:3001', 'https://hopecoinkk.musecoinx.com'],
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

// Replace your existing /api/users POST endpoint with this updated version
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});
