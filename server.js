import React, { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useDisconnect, useWaitForTransactionReceipt } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import contractABI from '../contractData/contract.json';
import './Admin.css';
import AdminContractManagement from '../components/admin/AdminContractManagement';

// Type definitions for TypeScript
interface NotificationType {
	message: string;
	type: 'success' | 'error' | 'info' | 'warning';
}

interface Document {
	id?: string;
	documentType?: string;
	walletAddress: string;
	uploadedAt: string;
	verified?: boolean;
	rejectionReason?: string;
	userName?: string;
	email?: string;
	frontImageUrl?: string;
	backImageUrl?: string;
	hasBackImage?: boolean;
	ipfsUrl?: string;
}

interface TaxIdDocument {
	id?: string;
	taxIdType?: string;
	walletAddress: string;
	uploadedAt: string;
	verified?: boolean;
	rejectionReason?: string;
	userName?: string;
	email?: string;
	ipfsUrl?: string;
}

interface PayoutLimits {
	totalLimit?: number;
	remainingLimit?: number;
	usedAmount?: number;
	isSet?: boolean;
}

interface DisbursementRecord {
	id?: string;
	createdAt: string;
	fromDate?: string;
	toDate?: string;
	period?: string;
	totalLimit?: number;
	isActive?: boolean;
	comments?: string;
}

interface User {
	walletAddress: string;
	name?: string;
	email?: string;
	totalMinted?: number;
}

interface Pagination {
	totalDocuments?: number;
	totalPages?: number;
	hasPrevPage?: boolean;
	hasNextPage?: boolean;
	totalRecords?: number;
}

interface DocumentStats {
	total?: number;
	pending?: number;
	approved?: number;
	rejected?: number;
}

interface DisbursementStats {
	totalDisbursements?: number;
	totalAmountDisbursed?: number;
	totalAmountUsed?: number;
	activeDisbursements?: number;
}

interface ArtistProject {
	id: string;
	projectName: string;
	projectSymbol: string;
	totalSupply: number;
	mintPrice: number;
	artistName: string;
	artistEmail: string;
	artistId: string;
	contractOwner: string;
	contractAddress?: string;
	networkId?: string;
	status: 'pending' | 'approved' | 'rejected';
	imageIpfsUrl?: string;
	createdAt: string;
	updatedAt: string;
	rejectionReason?: string;
	mintingEnabled?: boolean;
}

interface ArtistProjectsStats {
	total?: number;
	pending?: number;
	approved?: number;
	rejected?: number;
}

const AdminPanel = () => {
	const { address, isConnected } = useAccount();
	const { disconnect } = useDisconnect();
	const [isOwner, setIsOwner] = useState(false);
	const [loading, setLoading] = useState(true);
	const [notification, setNotification] = useState<NotificationType | null>(null);
	const [activeUpdate, setActiveUpdate] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState('contract');

	// State variables
	const [publicMintStatus, setPublicMintStatusState] = useState(false);
	const [maxPerWallet, setMaxPerWalletState] = useState(1);
	const [additionalPrice, setAdditionalPriceState] = useState(0);
	const [isAirdropping, setIsAirdropping] = useState(false);
	const [airdropReceiver, setAirdropReceiver] = useState('');
	const [airdropName, setAirdropName] = useState('');
	const [airdropEmail, setAirdropEmail] = useState('');
	const [pendingAirdrop, setPendingAirdrop] = useState<any>(null);
	const [airdropTokenId, setAirdropTokenId] = useState('');
	const [newOwnerAddress, setNewOwnerAddress] = useState('');
	const [isTransferring, setIsTransferring] = useState(false);
	const [isWithdrawing, setIsWithdrawing] = useState(false);
	const [basePrice, setBasePriceState] = useState(0);

	const [bulkAirdropFile, setBulkAirdropFile] = useState<File | null>(null);
	const [bulkAirdropData, setBulkAirdropData] = useState<any[]>([]);
	const [isProcessingBulkAirdrop, setIsProcessingBulkAirdrop] = useState(false);
	const [bulkAirdropProgress, setBulkAirdropProgress] = useState(0);
	const [bulkAirdropTxHash, setBulkAirdropTxHash] = useState<string | null>(null);

	// Document management states
	const [documents, setDocuments] = useState<Document[]>([]);
	const [pagination, setPagination] = useState<Pagination>({});
	const [documentStats, setDocumentStats] = useState<DocumentStats>({});
	const [currentPage, setCurrentPage] = useState(1);
	const [searchTerm, setSearchTerm] = useState('');
	const [documentsPerPage, setDocumentsPerPage] = useState(10);
	const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
	const [showDocumentModal, setShowDocumentModal] = useState(false);
	const [isVerifying, setIsVerifying] = useState(false);
	const [rejectionReason, setRejectionReason] = useState('');
	const [showRejectionModal, setShowRejectionModal] = useState(false);
	const [documentFilter, setDocumentFilter] = useState('all');

	// Tax ID document states
	const [taxIdDocuments, setTaxIdDocuments] = useState<TaxIdDocument[]>([]);
	const [taxIdPagination, setTaxIdPagination] = useState<Pagination>({});
	const [taxIdStats, setTaxIdStats] = useState<DocumentStats>({});
	const [taxIdCurrentPage, setTaxIdCurrentPage] = useState(1);
	const [taxIdSearchTerm, setTaxIdSearchTerm] = useState('');
	const [taxIdFilter, setTaxIdFilter] = useState('all');
	const [selectedTaxIdDocument, setSelectedTaxIdDocument] = useState<TaxIdDocument | null>(null);
	const [showTaxIdModal, setShowTaxIdModal] = useState(false);
	const [showTaxIdRejectionModal, setShowTaxIdRejectionModal] = useState(false);
	const [taxIdRejectionReason, setTaxIdRejectionReason] = useState('');
	const [isVerifyingTaxId, setIsVerifyingTaxId] = useState(false);

	const [artistProjects, setArtistProjects] = useState([]);
	const [artistProjectsLoading, setArtistProjectsLoading] = useState(false);
	const [artistProjectsFilter, setArtistProjectsFilter] = useState('all');
	const [artistProjectsSearch, setArtistProjectsSearch] = useState('');
	const [artistProjectsPage, setArtistProjectsPage] = useState(1);
	const [artistProjectsStats, setArtistProjectsStats] = useState<ArtistProjectsStats>({});

	// ADD THIS LINE - Missing state declaration
	const [selectedProject, setSelectedProject] = useState<any>(null); // Add this line

	interface ArtistProjectsStats {
		total?: number;
		pending?: number;
		approved?: number;
		rejected?: number;
	}

	const fetchArtistProjects = async (page = 1, status = 'all', search = '') => {
		try {
			setArtistProjectsLoading(true);

			// Always send 'all' for the all filter, not empty string
			const statusParam = status === 'all' ? 'all' : status;

			const params = new URLSearchParams({
				page: page.toString(),
				limit: '10',
				status: statusParam,
				search: search
			});

			console.log('🔍 Fetching artist projects with params:', {
				page,
				status: statusParam,
				search
			});

			const response = await fetch(`https://muse-be.onrender.com/api/admin/artist-projects?${params}`);

			if (response.ok) {
				const data = await response.json();
				console.log('✅ Artist projects fetched successfully:', {
					projectsCount: data.projects?.length,
					stats: data.stats,
					pagination: data.pagination
				});

				setArtistProjects(data.projects || []);
				setArtistProjectsStats(data.stats || {});

			} else {
				console.error('❌ Failed to load artist projects:', response.status);
				const errorText = await response.text();
				console.error('❌ Error response:', errorText);
				showNotification('Failed to load artist projects', 'error');
			}
		} catch (error) {
			console.error('❌ Error fetching artist projects:', error);
			showNotification('Error loading artist projects', 'error');
		} finally {
			setArtistProjectsLoading(false);
		}
	};

	// Payout management states
	const [payoutLimits, setPayoutLimits] = useState<PayoutLimits>({
		totalLimit: 0,
		remainingLimit: 0,
		usedAmount: 0,
		isSet: false
	});
	const [newPayoutLimit, setNewPayoutLimit] = useState('');
	const [isUpdatingLimits, setIsUpdatingLimits] = useState(false);

	// Disbursement management state
	const [projectName, setProjectName] = useState('');
	const [disbursementComments, setDisbursementComments] = useState('');
	const [disbursementHistory, setDisbursementHistory] = useState<DisbursementRecord[]>([]);
	const [disbursementPagination, setDisbursementPagination] = useState<Pagination>({});
	const [disbursementStats, setDisbursementStats] = useState<DisbursementStats>({});
	const [disbursementCurrentPage, setDisbursementCurrentPage] = useState(1);
	const [disbursementSearchTerm, setDisbursementSearchTerm] = useState('');
	const [disbursementPerPage, setDisbursementPerPage] = useState(10);
	const [isLoadingDisbursements, setIsLoadingDisbursements] = useState(false);
	const [disbursementFromDate, setDisbursementFromDate] = useState('');
	const [disbursementToDate, setDisbursementToDate] = useState('');

	// Payout search states
	const [payoutSearchMethod, setPayoutSearchMethod] = useState('wallet');
	const [payoutSearchValue, setPayoutSearchValue] = useState('');
	const [payoutSearchResults, setPayoutSearchResults] = useState<User[]>([]);
	const [selectedUserForPayout, setSelectedUserForPayout] = useState<User | null>(null);
	const [isSearchingUsers, setIsSearchingUsers] = useState(false);
	const [isRefreshingPayouts, setIsRefreshingPayouts] = useState(false);
	const [refreshResults, setRefreshResults] = useState<any>(null);
	const [copiedWallet, setCopiedWallet] = useState<string | null>(null);

	// Contract configuration
	const contractConfig = {
		address: contractABI.address as `0x${string}`,
		abi: contractABI.abi,
	};

	// Check if connected wallet is owner
	const { data: ownerAddress } = useReadContract({
		...contractConfig,
		functionName: 'owner',
	});

	// Read current contract settings
	const { data: currentPublicMintStatus } = useReadContract({
		...contractConfig,
		functionName: 'public_mint_status',
	});

	const { data: currentMaxPerWallet } = useReadContract({
		...contractConfig,
		functionName: 'max_per_wallet',
	});

	const { data: currentAdditionalPrice } = useReadContract({
		...contractConfig,
		functionName: 'additionalPrice',
	});

	const { data: currentBasePrice } = useReadContract({
		...contractConfig,
		functionName: 'basePrice',
	});

	const { data: totalSupply } = useReadContract({
		...contractConfig,
		functionName: 'totalSupply',
	});

	const { data: contractBalance } = useReadContract({
		...contractConfig,
		functionName: 'getBalance',
	});

	// Contract write hooks
	const { writeContract: updatePublicMintStatus } = useWriteContract({
		mutation: {
			onSuccess: async () => {
				setActiveUpdate(null);
				showNotification('Public mint status updated successfully', 'success');
				setTimeout(() => {
					window.location.reload();
				}, 1000);
			},
			onError: (error) => {
				showNotification(`Failed: ${error.message}`, 'error');
				setActiveUpdate(null);
			}
		}
	});

	const { writeContract: updateMaxPerWallet } = useWriteContract({
		mutation: {
			onSuccess: async () => {
				setActiveUpdate(null);
				showNotification('Max per wallet updated successfully', 'success');
				setTimeout(() => {
					window.location.reload();
				}, 1000);
			},
			onError: (error) => {
				showNotification(`Failed: ${error.message}`, 'error');
				setActiveUpdate(null);
			}
		}
	});

	const { writeContract: updateAdditionalPrice } = useWriteContract({
		mutation: {
			onSuccess: async () => {
				setActiveUpdate(null);
				showNotification('Additional price updated successfully', 'success');
				setTimeout(() => {
					window.location.reload();
				}, 1000);
			},
			onError: (error) => {
				showNotification(`Failed: ${error.message}`, 'error');
				setActiveUpdate(null);
			}
		}
	});

	const { writeContract: updateBasePrice } = useWriteContract({
		mutation: {
			onSuccess: async () => {
				setActiveUpdate(null);
				showNotification('Base price updated successfully', 'success');
				setTimeout(() => {
					window.location.reload();
				}, 1000);
			},
			onError: (error) => {
				showNotification(`Failed: ${error.message}`, 'error');
				setActiveUpdate(null);
			}
		}
	});

	const { writeContract: executeTransferOwnership } = useWriteContract({
		mutation: {
			onSuccess: async () => {
				setIsTransferring(false);
				showNotification('Ownership transferred successfully', 'success');
				setNewOwnerAddress('');
				setTimeout(() => {
					window.location.reload();
				}, 2000);
			},
			onError: (error) => {
				showNotification(`Transfer failed: ${error.message}`, 'error');
				setIsTransferring(false);
			}
		}
	});

	const { writeContract: executeWithdraw } = useWriteContract({
		mutation: {
			onSuccess: async () => {
				setIsWithdrawing(false);
				showNotification('Funds withdrawn successfully', 'success');
				setTimeout(() => {
					window.location.reload();
				}, 1000);
			},
			onError: (error) => {
				showNotification(`Withdrawal failed: ${error.message}`, 'error');
				setIsWithdrawing(false);
			}
		}
	});

	const { writeContract: executeAirdrop } = useWriteContract({
		mutation: {
			onSuccess: (data) => {
				console.log('🚀 Airdrop transaction initiated:', data);
				setPendingAirdrop({
					address: airdropReceiver,
					name: airdropName,
					email: airdropEmail,
					tokenId: airdropTokenId
				});
				showNotification('Airdrop transaction submitted, waiting for confirmation...', 'info');
			},
			onError: (error) => {
				console.error('❌ Airdrop transaction failed:', error);
				showNotification(`Airdrop failed: ${error.message}`, 'error');
				setIsAirdropping(false);
			}
		}
	});

	const { writeContract: executeBulkAirdrop } = useWriteContract({
		mutation: {
			onSuccess: (data) => {
				console.log('🚀 Bulk Airdrop transaction initiated:', data);
				setBulkAirdropTxHash(data);
				showNotification(`Bulk airdrop for ${bulkAirdropData.length} NFTs submitted, waiting for confirmation...`, 'info');
			},
			onError: (error) => {
				console.error('❌ Bulk Airdrop transaction failed:', error);
				showNotification(`Bulk airdrop failed: ${error.message}`, 'error');
				setIsProcessingBulkAirdrop(false);
				setBulkAirdropProgress(0);
			}
		}
	});

	const { isLoading: isWaitingForTx, isSuccess: isTxSuccess, isError: isTxError } = useWaitForTransactionReceipt({
		hash: pendingAirdrop?.transactionHash as `0x${string}`,
	});

	// Then use useEffect to handle the success and error states
	useEffect(() => {
		if (isTxSuccess && pendingAirdrop) {
			console.log('✅ Airdrop transaction confirmed');

			const handleSuccess = async () => {
				try {
					const backendData = {
						name: pendingAirdrop.name,
						email: pendingAirdrop.email,
						walletAddress: pendingAirdrop.address,
						transactionHash: pendingAirdrop.transactionHash,
						tokenId: pendingAirdrop.tokenId.toString(),
						nftMinted: true,
						mintedAt: new Date().toISOString(),
						ageConfirmed: true,
						termsAccepted: true,
						privacyPolicyAccepted: true,
						subscribe: true,
						isAirdrop: true
					};

					console.log('📤 Sending to backend:', backendData);

					const response = await fetch(`https://muse-be.onrender.com/api/users`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify(backendData)
					});

					if (!response.ok) {
						console.error('❌ Backend error');
						showNotification('Airdrop completed but failed to save user data', 'warning');
					} else {
						const result = await response.json();
						console.log('✅ Backend success:', result);
						showNotification('Airdrop completed successfully!', 'success');
					}

				} catch (error) {
					console.error('❌ Backend request failed:', error);
					showNotification('Airdrop completed but failed to save user data', 'warning');
				}

				setAirdropReceiver('');
				setAirdropName('');
				setAirdropEmail('');
				setAirdropTokenId('');
				setIsAirdropping(false);
				setPendingAirdrop(null);

				setTimeout(() => {
					window.location.reload();
				}, 2000);
			};

			handleSuccess();
		}
	}, [isTxSuccess, pendingAirdrop]);

	useEffect(() => {
		if (isTxError) {
			console.error('❌ Transaction failed');
			showNotification('Airdrop transaction failed', 'error');
			setIsAirdropping(false);
			setPendingAirdrop(null);
		}
	}, [isTxError]);

	// Check owner status
	useEffect(() => {
		if (address && ownerAddress) {
			setIsOwner(address.toLowerCase() === (ownerAddress as string).toLowerCase());
			setLoading(false);
		} else {
			setLoading(false);
		}
	}, [address, ownerAddress]);

	// Add this useEffect in your component - CORRECTED VERSION

	useEffect(() => {
		// Check if any modal is open
		const isModalOpen = selectedProject !== null ||
			showDocumentModal ||
			showTaxIdModal ||
			showRejectionModal ||
			showTaxIdRejectionModal;

		if (isModalOpen) {
			document.body.classList.add('modal-open');
			document.body.style.overflow = 'hidden';
			document.body.style.position = 'fixed';
			document.body.style.width = '100%';
			document.body.style.height = '100%';
		} else {
			document.body.classList.remove('modal-open');
			document.body.style.overflow = '';
			document.body.style.position = '';
			document.body.style.width = '';
			document.body.style.height = '';
		}

		// Cleanup on unmount
		return () => {
			document.body.classList.remove('modal-open');
			document.body.style.overflow = '';
			document.body.style.position = '';
			document.body.style.width = '';
			document.body.style.height = '';
		};
	}, [selectedProject, showDocumentModal, showTaxIdModal, showRejectionModal, showTaxIdRejectionModal]);
	// Set initial form values from contract
	useEffect(() => {
		if (currentPublicMintStatus !== undefined) {
			setPublicMintStatusState(Boolean(currentPublicMintStatus));
		}
		if (currentMaxPerWallet !== undefined) {
			setMaxPerWalletState(Number(currentMaxPerWallet));
		}
		if (currentAdditionalPrice !== undefined) {
			setAdditionalPriceState(Number(currentAdditionalPrice) / 1000000000000000000);
		}
		if (currentBasePrice !== undefined) {
			setBasePriceState(Number(currentBasePrice) / 1000000000000000000);
		}
	}, [currentPublicMintStatus, currentMaxPerWallet, currentAdditionalPrice, currentBasePrice]);

	// Notification function
	const showNotification = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
		console.log(`📢 Notification [${type}]:`, message);
		setNotification({ message, type });

		setTimeout(() => {
			setNotification(null);
		}, 5000);
	};

	// Handle form submissions
	const handlePublicMintStatusChange = async () => {
		try {
			setActiveUpdate('publicMintStatus');
			await updatePublicMintStatus({
				...contractConfig,
				functionName: 'setPublic_mint_status',
				args: [publicMintStatus],
			} as any);
		} catch (err) {
			setActiveUpdate(null);
		}
	};

	const handleMaxPerWalletChange = async () => {
		try {
			setActiveUpdate('maxPerWallet');
			await updateMaxPerWallet({
				...contractConfig,
				functionName: 'setMax_per_wallet',
				args: [maxPerWallet],
			} as any);
		} catch (err) {
			setActiveUpdate(null);
		}
	};

	const handleAdditionalPriceChange = async () => {
		try {
			setActiveUpdate('additionalPrice');
			await updateAdditionalPrice({
				...contractConfig,
				functionName: 'setAdditionalPrice',
				args: [BigInt(Math.floor(additionalPrice * 1000000000000000000))],
			} as any);
		} catch (err) {
			setActiveUpdate(null);
		}
	};

	const handleBasePriceChange = async () => {
		try {
			setActiveUpdate('basePrice');
			await updateBasePrice({
				...contractConfig,
				functionName: 'setBasePrice',
				args: [BigInt(Math.floor(basePrice * 1000000000000000000))],
			} as any);
		} catch (err) {
			setActiveUpdate(null);
		}
	};

	const handleAirdrop = async () => {
		// Validation
		if (!airdropReceiver || !airdropName || !airdropEmail || !airdropTokenId) {
			showNotification('Please fill in all fields', 'error');
			return;
		}

		// Validate Ethereum address
		const addressRegex = /^0x[a-fA-F0-9]{40}$/;
		if (!addressRegex.test(airdropReceiver)) {
			showNotification('Please enter a valid Ethereum address', 'error');
			return;
		}

		// Validate email
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(airdropEmail)) {
			showNotification('Please enter a valid email address', 'error');
			return;
		}

		// Validate token ID
		const tokenIdNum = parseInt(airdropTokenId);
		if (isNaN(tokenIdNum) || tokenIdNum < 0) {
			showNotification('Please enter a valid token ID (0 or positive number)', 'error');
			return;
		}

		try {
			setIsAirdropping(true);
			console.log('🎯 Executing airdrop:', {
				receiver: airdropReceiver,
				name: airdropName,
				email: airdropEmail,
				tokenId: tokenIdNum
			});

			await executeAirdrop({
				...contractConfig,
				functionName: 'airdrop',
				args: [
					airdropReceiver as `0x${string}`,
					airdropName,
					airdropEmail,
					BigInt(tokenIdNum)
				],
			} as any);

		} catch (error: any) {
			console.error('❌ Error executing airdrop:', error);
			showNotification(`Failed to execute airdrop: ${error.message}`, 'error');
			setIsAirdropping(false);
		}
	};

	const isAirdropDisabled = isAirdropping ||
		isWaitingForTx ||
		!airdropReceiver ||
		!airdropName ||
		!airdropEmail ||
		!airdropTokenId;

	// Handle bulk airdrop file upload
	const handleBulkAirdropFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		setBulkAirdropFile(file);
		setBulkAirdropProgress(0);

		const reader = new FileReader();
		reader.onload = async (e) => {
			try {
				setIsProcessingBulkAirdrop(true);
				const content = e.target?.result as string;
				const lines = content.split('\n').filter(line => line.trim() !== '');

				const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
				const data = [];

				for (let i = 1; i < lines.length; i++) {
					const values = lines[i].split(',');
					if (values.length < 4) continue;

					const item = {
						address: values[headers.indexOf('address')].trim(),
						name: values[headers.indexOf('name')].trim(),
						email: values[headers.indexOf('email')].trim(),
						tokenId: parseInt(values[headers.indexOf('tokenid')].trim())
					};

					if (
						!/^0x[a-fA-F0-9]{40}$/.test(item.address) ||
						!item.name ||
						!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email) ||
						isNaN(item.tokenId) || item.tokenId < 0
					) {
						console.error('Invalid data in row', i, item);
						continue;
					}

					data.push(item);
					setBulkAirdropProgress(Math.floor((i / (lines.length - 1)) * 100));
				}

				setBulkAirdropData(data);
				setIsProcessingBulkAirdrop(false);
				showNotification(`Successfully parsed ${data.length} valid airdrop entries`, 'success');

			} catch (error) {
				console.error('Error parsing CSV:', error);
				showNotification('Error parsing CSV file. Please check the format.', 'error');
				setIsProcessingBulkAirdrop(false);
			}
		};
		reader.readAsText(file);
	};

	const handleBulkAirdrop = async () => {
		if (bulkAirdropData.length === 0) {
			showNotification('No valid airdrop data to process', 'error');
			return;
		}

		if (bulkAirdropData.length > 500) {
			showNotification('Maximum 500 airdrops at once', 'error');
			return;
		}

		try {
			setIsProcessingBulkAirdrop(true);
			await executeBulkAirdrop({
				...contractConfig,
				functionName: 'bulkAirdrop',
				args: [
					bulkAirdropData.map(item => item.address as `0x${string}`),
					bulkAirdropData.map(item => item.name),
					bulkAirdropData.map(item => item.email),
					bulkAirdropData.map(item => BigInt(item.tokenId))
				],
			} as any);
		} catch (error: any) {
			console.error('Error executing bulk airdrop:', error);
			showNotification(`Failed to execute bulk airdrop: ${error.message}`, 'error');
			setIsProcessingBulkAirdrop(false);
		}
	};

	const handleTransferOwnership = async () => {
		// Validation
		if (!newOwnerAddress) {
			showNotification('Please enter a new owner address', 'error');
			return;
		}

		// Validate Ethereum address
		const addressRegex = /^0x[a-fA-F0-9]{40}$/;
		if (!addressRegex.test(newOwnerAddress)) {
			showNotification('Please enter a valid Ethereum address', 'error');
			return;
		}

		// Confirm with user
		const confirmed = window.confirm(
			`Are you sure you want to transfer ownership to ${newOwnerAddress}? This action cannot be undone!`
		);

		if (!confirmed) return;

		try {
			setIsTransferring(true);
			console.log('🔄 Transferring ownership to:', newOwnerAddress);
			await executeTransferOwnership({
				...contractConfig,
				functionName: 'transferOwnership',
				args: [newOwnerAddress as `0x${string}`],
			} as any);
		} catch (error: any) {
			console.error('❌ Error transferring ownership:', error);
			showNotification(`Failed to transfer ownership: ${error.message}`, 'error');
			setIsTransferring(false);
		}
	};

	// Handle withdraw
	const handleWithdraw = async () => {
		// Confirm with user
		const confirmed = window.confirm(
			'Are you sure you want to withdraw all funds from the contract?'
		);

		if (!confirmed) return;

		try {
			setIsWithdrawing(true);
			console.log('💰 Withdrawing funds...');
			await executeWithdraw({
				...contractConfig,
				functionName: 'withdraw',
				args: [],
			} as any);
		} catch (error: any) {
			console.error('❌ Error withdrawing funds:', error);
			showNotification(`Failed to withdraw funds: ${error.message}`, 'error');
			setIsWithdrawing(false);
		}
	};
	// Document management functions
	const fetchDocuments = async (page = 1, status = 'all', search = '') => {
		try {
			const params = new URLSearchParams({
				page: page.toString(),
				limit: documentsPerPage.toString(),
				status,
				search,
				sortBy: 'uploadedAt',
				sortOrder: 'desc'
			});

			console.log('🔍 Fetching identity documents with params:', { page, status, search, limit: documentsPerPage });

			const response = await fetch(`https://muse-be.onrender.com/api/admin/identity-documents?${params}`);

			if (response.ok) {
				const data = await response.json();
				console.log('✅ Identity documents fetched successfully:', data);

				setDocuments(data.documents || []);
				setPagination(data.pagination || {});
				setDocumentStats(data.stats || {});
				setCurrentPage(page);
			} else {
				console.error('❌ Failed to load identity documents:', response.status);
				showNotification('Failed to load identity documents', 'error');
			}
		} catch (error) {
			console.error('❌ Error fetching identity documents:', error);
			showNotification('Error loading identity documents', 'error');
		}
	};

	const fetchTaxIdDocuments = async (page = 1, status = 'all', search = '') => {
		try {
			const params = new URLSearchParams({
				page: page.toString(),
				limit: documentsPerPage.toString(),
				status,
				search,
				sortBy: 'uploadedAt',
				sortOrder: 'desc'
			});

			console.log('🔍 Fetching tax ID documents with params:', { page, status, search, limit: documentsPerPage });

			const response = await fetch(`https://muse-be.onrender.com/api/admin/tax-id-documents?${params}`);

			if (response.ok) {
				const data = await response.json();
				console.log('✅ Tax ID documents fetched successfully:', data);

				setTaxIdDocuments(data.documents || []);
				setTaxIdPagination(data.pagination || {});
				setTaxIdStats(data.stats || {});
				setTaxIdCurrentPage(page);
			} else {
				console.error('❌ Failed to load tax ID documents:', response.status);
				showNotification('Failed to load tax ID documents', 'error');
			}
		} catch (error) {
			console.error('❌ Error fetching tax ID documents:', error);
			showNotification('Error loading tax ID documents', 'error');
		}
	};

	const handleVerifyDocument = async (walletAddress: string, approved: boolean, reason = '') => {
		try {
			setIsVerifying(true);
			console.log('🔄 Verifying identity document:', { walletAddress, approved, reason });

			const response = await fetch(`https://muse-be.onrender.com/api/admin/paypal/${walletAddress}/verify-identity`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					verified: approved,
					rejectionReason: approved ? '' : reason
				})
			});

			const data = await response.json();

			if (response.ok && data.success) {
				showNotification(
					approved ? 'Identity document approved successfully!' : 'Identity document rejected successfully!',
					'success'
				);

				await fetchDocuments(currentPage, documentFilter, searchTerm);

				setShowDocumentModal(false);
				setShowRejectionModal(false);
				setSelectedDocument(null);
				setRejectionReason('');
			} else {
				showNotification(data.error || 'Failed to update document status', 'error');
			}
		} catch (error) {
			console.error('❌ Error verifying identity document:', error);
			showNotification('Error updating document status', 'error');
		} finally {
			setIsVerifying(false);
		}
	};

	const handleVerifyTaxIdDocument = async (walletAddress: string, approved: boolean, reason = '') => {
		try {
			setIsVerifyingTaxId(true);
			console.log('🔄 Verifying tax ID document:', { walletAddress, approved, reason });

			const response = await fetch(`https://muse-be.onrender.com/api/admin/paypal/${walletAddress}/verify-tax-id`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					verified: approved,
					rejectionReason: approved ? '' : reason
				})
			});

			const data = await response.json();

			if (response.ok && data.success) {
				showNotification(
					approved ? 'Tax ID document approved successfully!' : 'Tax ID document rejected successfully!',
					'success'
				);

				await fetchTaxIdDocuments(taxIdCurrentPage, taxIdFilter, taxIdSearchTerm);

				setShowTaxIdModal(false);
				setShowTaxIdRejectionModal(false);
				setSelectedTaxIdDocument(null);
				setTaxIdRejectionReason('');
			} else {
				showNotification(data.error || 'Failed to update tax ID document status', 'error');
			}
		} catch (error) {
			console.error('❌ Error verifying tax ID document:', error);
			showNotification('Error updating tax ID document status', 'error');
		} finally {
			setIsVerifyingTaxId(false);
		}
	};

	const openDocumentModal = (document: Document) => {
		console.log('📄 Opening identity document modal:', document);
		setSelectedDocument(document);
		setShowDocumentModal(true);
	};

	const openTaxIdModal = (document: TaxIdDocument) => {
		console.log('📄 Opening tax ID document modal:', document);
		setSelectedTaxIdDocument(document);
		setShowTaxIdModal(true);
	};

	const handleRejectClick = () => {
		setShowDocumentModal(false);
		setShowRejectionModal(true);
	};

	const handleTaxIdRejectClick = () => {
		setShowTaxIdModal(false);
		setShowTaxIdRejectionModal(true);
	};

	const handleRejectSubmit = async () => {
		if (!rejectionReason.trim()) {
			showNotification('Please provide a rejection reason', 'error');
			return;
		}

		await handleVerifyDocument(selectedDocument!.walletAddress, false, rejectionReason.trim());
	};

	const handleTaxIdRejectSubmit = async () => {
		if (!taxIdRejectionReason.trim()) {
			showNotification('Please provide a rejection reason', 'error');
			return;
		}

		await handleVerifyTaxIdDocument(selectedTaxIdDocument!.walletAddress, false, taxIdRejectionReason.trim());
	};

	const formatDocumentType = (type?: string) => {
		if (!type) return 'Unknown';
		return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
	};

	const formatTaxIdType = (type?: string) => {
		const typeMap: { [key: string]: string } = {
			'ssn_card': 'Social Security Card',
			'tax_return': 'Tax Return (1040)',
			'ein_letter': 'EIN Assignment Letter',
			'itin_letter': 'ITIN Assignment Letter',
			'other': 'Other Tax Document'
		};
		return typeMap[type!] || type!.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
	};

	const handleCopyWallet = async (walletAddress: string) => {
		try {
			await navigator.clipboard.writeText(walletAddress);
			setCopiedWallet(walletAddress);
			showNotification('Wallet address copied to clipboard', 'success');

			setTimeout(() => {
				setCopiedWallet(null);
			}, 2000);
		} catch (error) {
			console.error('Failed to copy wallet address:', error);
			showNotification('Failed to copy wallet address', 'error');
		}
	};

	// Payout management functions
	const fetchPayoutLimits = async () => {
		try {
			const response = await fetch(`https://muse-be.onrender.com/api/admin/payout-limits`, {
				headers: {
					'X-Admin-Key': import.meta.env.VITE_ADMIN_KEY || 'your-admin-key-here'
				}
			});

			if (response.ok) {
				const data = await response.json();
				setPayoutLimits(data);
			} else {
				console.error('Failed to fetch payout limits');
			}
		} catch (error) {
			console.error('Error fetching payout limits:', error);
		}
	};

	const fetchDisbursementHistory = async (page = 1, search = '') => {
		try {
			setIsLoadingDisbursements(true);

			const params = new URLSearchParams({
				page: page.toString(),
				limit: disbursementPerPage.toString(),
				search
			});

			const response = await fetch(`https://muse-be.onrender.com/api/admin/disbursement-history?${params}`, {
				headers: {
					'X-Admin-Key': import.meta.env.VITE_ADMIN_KEY || 'your-admin-key-here'
				}
			});

			if (response.ok) {
				const data = await response.json();
				setDisbursementHistory(data.records || []);
				setDisbursementPagination(data.pagination || {});
				setDisbursementStats(data.stats || {});
				setDisbursementCurrentPage(page);

			} else {
				showNotification('Failed to load disbursement history', 'error');
			}
		} catch (error) {
			console.error('Error fetching disbursement history:', error);
			showNotification('Error loading disbursement history', 'error');
		} finally {
			setIsLoadingDisbursements(false);
		}
	};

	const handleSetPayoutLimit = async () => {
		if (!newPayoutLimit || parseFloat(newPayoutLimit) <= 0) {
			showNotification('Please enter a valid disbursement amount greater than 0', 'error');
			return;
		}

		if (parseFloat(newPayoutLimit) > 100000) {
			showNotification('Maximum disbursement amount is $100,000', 'error');
			return;
		}

		try {
			setIsUpdatingLimits(true);
			showNotification('Setting disbursement...', 'info');

			const response = await fetch(`https://muse-be.onrender.com/api/admin/payout-limits`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Admin-Key': import.meta.env.VITE_ADMIN_KEY || 'your-admin-key-here'
				},
				body: JSON.stringify({
					totalLimit: parseFloat(newPayoutLimit),
					fromDate: disbursementFromDate,
					toDate: disbursementToDate,
					projectName: projectName.trim() || null,
					comments: disbursementComments.trim() || null
				})
			});

			const data = await response.json();

			if (response.ok && data.success) {
				showNotification('Disbursement set successfully!', 'success');

				await fetchPayoutLimits();
				await fetchDisbursementHistory(1, '');

				setNewPayoutLimit('');
				setProjectName('');
				setDisbursementComments('');
			} else {
				showNotification(data.error || 'Failed to set disbursement', 'error');
			}
		} catch (error) {
			console.error('Error setting disbursement:', error);
			showNotification('Failed to set disbursement', 'error');
		} finally {
			setIsUpdatingLimits(false);
		}
	};

	const handleResetPayoutLimits = async () => {
		const confirmed = window.confirm(
			'Are you sure you want to reset the payout limits? This will set the used amount back to 0.'
		);

		if (!confirmed) return;

		try {
			setIsUpdatingLimits(true);
			showNotification('Resetting payout limits...', 'info');

			const response = await fetch(`https://muse-be.onrender.com/api/admin/payout-limits/reset`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Admin-Key': import.meta.env.VITE_ADMIN_KEY || 'your-admin-key-here'
				}
			});

			const data = await response.json();

			if (response.ok && data.success) {
				showNotification('Payout limits reset successfully!', 'success');
				await fetchPayoutLimits();
			} else {
				showNotification(data.error || 'Failed to reset payout limits', 'error');
			}
		} catch (error) {
			console.error('Error resetting payout limits:', error);
			showNotification('Failed to reset payout limits', 'error');
		} finally {
			setIsUpdatingLimits(false);
		}
	};

	const handleSearchUsers = async () => {
		if (!payoutSearchValue.trim()) {
			showNotification('Please enter a search term', 'error');
			return;
		}

		try {
			setIsSearchingUsers(true);
			setPayoutSearchResults([]);
			setSelectedUserForPayout(null);

			console.log('🔍 Searching users:', { method: payoutSearchMethod, value: payoutSearchValue });

			const response = await fetch(`https://muse-be.onrender.com/api/admin/search-users`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					searchMethod: payoutSearchMethod,
					searchValue: payoutSearchValue.trim()
				})
			});

			const data = await response.json();

			if (response.ok && data.success) {
				setPayoutSearchResults(data.users || []);

				if (data.users.length === 0) {
					showNotification('No users found matching your search', 'info');
				} else {
					showNotification(`Found ${data.users.length} user(s)`, 'success');

					if (data.users.length === 1) {
						setSelectedUserForPayout(data.users[0]);
					}
				}
			} else {
				showNotification(data.error || 'Search failed', 'error');
			}
		} catch (error) {
			console.error('Error searching users:', error);
			showNotification('Search failed', 'error');
		} finally {
			setIsSearchingUsers(false);
		}
	};

	const handleRefreshPayoutStatus = async () => {
		if (!selectedUserForPayout || !selectedUserForPayout.walletAddress) {
			showNotification('Please select a user first', 'error');
			return;
		}

		const walletAddress = selectedUserForPayout.walletAddress;

		try {
			setIsRefreshingPayouts(true);
			setRefreshResults(null);

			showNotification(`Checking payout status for ${selectedUserForPayout.name || 'user'}...`, 'info');

			const response = await fetch(`https://muse-be.onrender.com/api/admin/refresh-payout-status/${walletAddress}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				}
			});

			const data = await response.json();

			if (response.ok && data.success) {
				setRefreshResults({
					...data,
					userInfo: {
						name: selectedUserForPayout.name,
						email: selectedUserForPayout.email,
						walletAddress: walletAddress
					}
				});
				showNotification(data.message, 'success');
			} else {
				showNotification(data.error || 'Failed to refresh payout status', 'error');
			}
		} catch (error) {
			console.error('Error refreshing payout status:', error);
			showNotification('Failed to refresh payout status', 'error');
		} finally {
			setIsRefreshingPayouts(false);
		}
	};

	const handleViewProject = (project) => {
		// Show project details modal
		console.log('View project:', project);
	};

	const handleProjectStatus = async (projectId, status) => {
		try {
			const response = await fetch(`https://muse-be.onrender.com/api/admin/artist-projects/${projectId}/status`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ status })
			});

			if (response.ok) {
				showNotification(`Project ${status} successfully`, 'success');
				fetchArtistProjects(artistProjectsPage, artistProjectsFilter, artistProjectsSearch);
			} else {
				const errorData = await response.json();
				showNotification(errorData.error || `Failed to ${status} project`, 'error');
			}
		} catch (error) {
			console.error(`❌ Error ${status} project:`, error);
			showNotification(`Failed to ${status} project`, 'error');
		}
	};

	const handleRejectProject = async (project) => {
		const rejectionReason = prompt('Please provide a reason for rejecting this project:');

		if (rejectionReason === null) return; // User cancelled

		if (!rejectionReason.trim()) {
			showNotification('Please provide a rejection reason', 'error');
			return;
		}

		try {
			const response = await fetch(`https://muse-be.onrender.com/api/admin/artist-projects/${project.id}/status`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					status: 'rejected',
					rejectionReason: rejectionReason.trim()
				})
			});

			if (response.ok) {
				showNotification('Project rejected successfully', 'success');
				fetchArtistProjects(artistProjectsPage, artistProjectsFilter, artistProjectsSearch);
			} else {
				const errorData = await response.json();
				showNotification(errorData.error || 'Failed to reject project', 'error');
			}
		} catch (error) {
			console.error('❌ Error rejecting project:', error);
			showNotification('Failed to reject project', 'error');
		}
	};

	const handleDeleteProject = async (projectId) => {
		if (window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
			try {
				const response = await fetch(`https://muse-be.onrender.com/api/admin/artist-projects/${projectId}`, {
					method: 'DELETE',
					headers: {
						'Content-Type': 'application/json',
					}
				});

				if (response.ok) {
					showNotification('Project deleted successfully', 'success');
					// Refresh the projects list
					fetchArtistProjects(artistProjectsPage, artistProjectsFilter, artistProjectsSearch);
				} else {
					const errorData = await response.json();
					showNotification(errorData.error || 'Failed to delete project', 'error');
				}
			} catch (error) {
				console.error('❌ Error deleting project:', error);
				showNotification('Failed to delete project', 'error');
			}
		}
	};

	useEffect(() => {
		if (address && isOwner) {
			console.log('🚀 Initializing admin panel data...');

			const initializeData = async () => {
				try {
					await Promise.all([
						fetchPayoutLimits(),
						fetchDocuments(1, 'all', ''),
						fetchTaxIdDocuments(1, 'all', ''),
						fetchDisbursementHistory(1, '')
					]);
					console.log('✅ Admin panel data initialized successfully');
				} catch (error) {
					console.error('❌ Error initializing admin data:', error);
					showNotification('Error loading admin data', 'error');
				}
			};

			setTimeout(initializeData, 100);
		}
	}, [address, isOwner]);

	useEffect(() => {
		if (address && isOwner && activeTab === 'artists') {
			// Fetch artist projects when the artists tab becomes active
			fetchArtistProjects(1, artistProjectsFilter, artistProjectsSearch);
		}
	}, [activeTab, address, isOwner]);

	useEffect(() => {
		if (address && isOwner && currentPage > 0) {
			const delayedSearch = setTimeout(() => {
				fetchDocuments(1, documentFilter, searchTerm);
			}, 500);

			return () => clearTimeout(delayedSearch);
		}
	}, [searchTerm, documentFilter]);

	useEffect(() => {
		if (address && isOwner && taxIdCurrentPage > 0) {
			const delayedSearch = setTimeout(() => {
				fetchTaxIdDocuments(1, taxIdFilter, taxIdSearchTerm);
			}, 500);

			return () => clearTimeout(delayedSearch);
		}
	}, [taxIdSearchTerm, taxIdFilter]);

	// Wallet connection functions
	const shortenAddress = (address: string | undefined) => {
		if (!address) return "Connect";
		try {
			return address.slice(0, 6) + "..." + address.slice(-4);
		} catch (error) {
			console.log(error);
			return "Connect";
		}
	};

	const disconnectWallet = () => {
		disconnect();
	};

	if (loading) {
		return <div className="admin-loading">Loading...</div>;
	}

	if (!isConnected || !address) {
		return (
			<div className="admin-connect-wallet">
				<h2>Admin Panel</h2>
				<p className='cWallet'>Please connect your wallet to access the admin panel</p>
				<ConnectButton.Custom>
					{({ openConnectModal }) => (
						<button onClick={openConnectModal} className="connect-wallet-btn3">
							Connect Wallet
						</button>
					)}
				</ConnectButton.Custom>
			</div>
		);
	}

const AUTHORIZED_WALLETS = [
  '0x8bb8aadc2b1c230548123a22bbe1335cb361d55a' // lowercase version
];

// Then modify your access check:
const isAuthorized = isOwner || (address && AUTHORIZED_WALLETS.includes(address.toLowerCase()));

if (!isAuthorized) {
  return (
    <div className="admin-not-owner">
      <h2>Admin Panel</h2>
      <p className="error-message">You are not authorized to access this panel</p>
      <p className="cWallet">Connected wallet: {address}</p>
      <ConnectButton.Custom>
        {({ account }) => (
          <button onClick={disconnectWallet} className="disconnect-btn">
            <i className="fas fa-wallet"></i> {shortenAddress(account?.address)}
          </button>
        )}
      </ConnectButton.Custom>
    </div>
  );
}

	// Tab configuration
	const tabs = [
		{ id: 'contract', label: 'Contract Settings', icon: '⚙️' },
		{ id: 'artists', label: "Artist's Contracts", icon: '🎨' },
		{ id: 'identity', label: 'Identity Documents', icon: '📄' },
		{ id: 'taxid', label: 'Tax ID Documents', icon: '🧾' },
		{ id: 'royalty', label: 'Royalty Management', icon: '💰' },
		{ id: 'payout', label: 'Payout Status', icon: '💳' }
	];

	// Render tab content based on active tab
	const renderTabContent = () => {
		switch (activeTab) {
			case 'contract':
				return (
					<div className="tab-content">
						<div className="contract-settings-container">
							<section className="admin-section contract-settings">
								<h2>Contract Settings</h2>

								<div className="admin-form-group">
									<h2 id="h2New">Public Mint Status</h2>
									<div className="toggle-switch">
										<input
											type="checkbox"
											id="publicMintStatus"
											checked={publicMintStatus}
											onChange={(e) => setPublicMintStatusState(e.target.checked)}
											disabled={activeUpdate !== null}
										/>
										<label htmlFor="publicMintStatus" className="toggle-label"></label>
									</div>
									<button
										onClick={handlePublicMintStatusChange}
										className="admin-submit-btn"
										disabled={activeUpdate !== null}
									>
										{activeUpdate === 'publicMintStatus' ? 'Updating...' : 'Update Status'}
									</button>
								</div>

								<div className="admin-form-group">
									<h2 id="h2New">Max NFTs Per Wallet</h2>
									<input
										type="number"
										min="1"
										value={maxPerWallet}
										onChange={(e) => setMaxPerWalletState(Number(e.target.value))}
										disabled={activeUpdate !== null}
									/>
									<button
										onClick={handleMaxPerWalletChange}
										className="admin-submit-btn"
										disabled={activeUpdate !== null}
									>
										{activeUpdate === 'maxPerWallet' ? 'Updating...' : 'Update Limit'}
									</button>
								</div>

								<section className="admin-form-group">
									<h2 id="h2New">Airdrop NFT (Specific Token ID to single recipient)</h2>
									<div className="airdrop-input-group">
										<label>Receiver Address</label>
										<input
											type="text"
											className="airdrop-input"
											value={airdropReceiver}
											onChange={(e) => setAirdropReceiver(e.target.value)}
											placeholder="0x123..."
											disabled={isAirdropping}
										/>
									</div>

									<div className="airdrop-input-group">
										<label>Name</label>
										<input
											type="text"
											className="airdrop-input"
											value={airdropName}
											onChange={(e) => setAirdropName(e.target.value)}
											placeholder="John Doe"
											disabled={isAirdropping}
										/>
									</div>

									<div className="airdrop-input-group">
										<label>Email</label>
										<input
											type="email"
											className="airdrop-input"
											value={airdropEmail}
											onChange={(e) => setAirdropEmail(e.target.value)}
											placeholder="john@email.com"
											disabled={isAirdropping}
										/>
									</div>

									<div className="airdrop-input-group">
										<label>Token ID</label>
										<input
											type="number"
											className="airdrop-input"
											value={airdropTokenId}
											onChange={(e) => setAirdropTokenId(e.target.value)}
											placeholder="1"
											min="0"
											disabled={isAirdropping}
										/>
									</div>

									<button
										onClick={handleAirdrop}
										className="airdrop-submit-btn"
										disabled={isAirdropDisabled}
									>
										{isWaitingForTx ? 'Confirming Transaction...' :
											isAirdropping ? 'Processing Airdrop...' :
												'Execute Airdrop'}
									</button>

									<div>Total supply - {Number(totalSupply)}</div>

									<p className="airdrop-note">
										Note: The recipient will receive the NFT with the specified Token ID. Make sure the Token ID doesn't already exist!
									</p>
								</section>

								<div className="admin-form-group">
									<h2 id="h2New">Additional Price (ETH)</h2>
									<input
										type="number"
										step="0.01"
										min="0"
										value={additionalPrice}
										onChange={(e) => setAdditionalPriceState(Number(e.target.value))}
										disabled={activeUpdate !== null}
									/>
									<button
										onClick={handleAdditionalPriceChange}
										className="admin-submit-btn"
										disabled={activeUpdate !== null}
									>
										{activeUpdate === 'additionalPrice' ? 'Updating...' : 'Update Price'}
									</button>
								</div>

								<div className="admin-form-group">
									<h2 id="h2New">Base Price (ETH)</h2>
									<input
										type="number"
										step="0.01"
										min="0"
										value={basePrice}
										onChange={(e) => setBasePriceState(Number(e.target.value))}
										disabled={activeUpdate !== null}
									/>
									<button
										onClick={handleBasePriceChange}
										className="admin-submit-btn"
										disabled={activeUpdate !== null}
									>
										{activeUpdate === 'basePrice' ? 'Updating...' : 'Update Base Price'}
									</button>
									<p className="airdrop-note">
										This is the price for the first NFT mint per wallet.
									</p>
								</div>

								{/* Transfer Ownership Section */}
								<section className="admin-form-group">
									<h2 id="h2New">Transfer Ownership</h2>
									<div className="airdrop-input-group">
										<label>New Owner Address</label>
										<input
											type="text"
											className="airdrop-input"
											value={newOwnerAddress}
											onChange={(e) => setNewOwnerAddress(e.target.value)}
											placeholder="0x123..."
											disabled={isTransferring}
										/>
									</div>

									<button
										onClick={handleTransferOwnership}
										className="admin-submit-btn"
										disabled={
											isTransferring ||
											!newOwnerAddress ||
											!/^0x[a-fA-F0-9]{40}$/.test(newOwnerAddress)
										}
										style={{ backgroundColor: '#dc3545', borderColor: '#dc3545' }}
									>
										{isTransferring ? 'Transferring...' : 'Transfer Ownership'}
									</button>

									<p className="airdrop-note" style={{ color: '#dc3545' }}>
										⚠️ WARNING: This action is irreversible! You will lose admin access to this contract.
									</p>
								</section>

								{/* Withdraw Funds Section */}
								<section className="admin-form-group">
									<h2 id="h2New">Withdraw Contract Funds</h2>
									<div className="contract-info">
										<p><strong>Contract Balance:</strong> {contractBalance ?
											(Number(contractBalance) / 1000000000000000000).toFixed(4) : '0'} ETH</p>
									</div>

									<button
										onClick={handleWithdraw}
										className="admin-submit-btn"
										disabled={isWithdrawing}
										style={{ backgroundColor: '#28a745', borderColor: '#28a745' }}
									>
										{isWithdrawing ? 'Withdrawing...' : 'Withdraw All Funds'}
									</button>

									<p className="airdrop-note">
										This will withdraw all ETH from the contract to the owner's wallet.
									</p>
								</section>

								<section className="admin-form-group">
									<h2 id="h2New">Bulk Airdrop (CSV Upload)</h2>

									<div className="airdrop-input-group">
										<label>Upload CSV File</label>
										<input
											type="file"
											accept=".csv"
											onChange={handleBulkAirdropFileUpload}
											disabled={isProcessingBulkAirdrop || !!bulkAirdropTxHash}
										/>
										<p className="airdrop-note">
											CSV format: address,name,email,tokenId<br />
											Example: 0x123...,John Doe,john@example.com,123
										</p>
									</div>

									{isProcessingBulkAirdrop && !bulkAirdropTxHash && (
										<div className="progress-container">
											<div className="progress-bar" style={{ width: `${bulkAirdropProgress}%` }}></div>
											<div className="progress-text">
												{bulkAirdropProgress < 100 ? 'Processing CSV...' : 'Ready to airdrop'}
											</div>
										</div>
									)}

									{bulkAirdropData.length > 0 && (
										<div className="airdrop-summary">
											<p>Ready to airdrop {bulkAirdropData.length} NFTs</p>
											<div className="airdrop-preview">
												{bulkAirdropData.slice(0, 3).map((item, index) => (
													<div key={index} className="airdrop-preview-item">
														<p>To: {item.address.substring(0, 6)}...{item.address.substring(38)}</p>
														<p>Name: {item.name}, Email: {item.email.substring(0, 3)}...{item.email.split('@')[1]}</p>
														<p>Token ID: {item.tokenId}</p>
													</div>
												))}
												{bulkAirdropData.length > 3 && (
													<p>+ {bulkAirdropData.length - 3} more...</p>
												)}
											</div>
										</div>
									)}

									<button
										onClick={handleBulkAirdrop}
										className="airdrop-submit-btn"
										disabled={
											isProcessingBulkAirdrop ||
											bulkAirdropData.length === 0 ||
											!!bulkAirdropTxHash
										}
									>
										{bulkAirdropTxHash ? 'Airdrop in progress...' : 'Execute Bulk Airdrop'}
									</button>

									<p className="airdrop-note">
										Note: This will airdrop NFTs to multiple addresses at once (max 500 per transaction).
										Make sure all token IDs are unique and don't already exist.
									</p>
								</section>
							</section>

							<section className="admin-section current-settings">
								<h2>Current Contract Settings</h2>
								<div className="contract-info">
									<p><strong>Contract Address:</strong> {contractABI.address}</p>
									<p><strong>Public Mint Status:</strong> {currentPublicMintStatus ? 'Enabled' : 'Disabled'}</p>
									<p><strong>Max Per Wallet:</strong> {currentMaxPerWallet?.toString()}</p>
									<p><strong>Additional Price:</strong> {currentAdditionalPrice ? (Number(currentAdditionalPrice) / 1000000000000000000) : 0} ETH</p>
									<p><strong>Base Price:</strong> {currentBasePrice ? (Number(currentBasePrice) / 1000000000000000000) : 0} ETH</p>
									<p><strong>Contract Balance:</strong> {contractBalance ? (Number(contractBalance) / 1000000000000000000).toFixed(4) : '0'} ETH</p>
									<p><strong>Total Supply:</strong> {Number(totalSupply) || 0}</p>
								</div>
							</section>
						</div>
					</div>
				);

			case 'artists':
				return (
					<div className="tab-content full-width">
						<section className="admin-form-group full-width">
							<h2 id="h2New">🎨 Artist's Contracts</h2>

							{/* Statistics Dashboard - UNCHANGED */}
							<div className="document-stats-dashboard">
								<div className="stat-card total">
									<div className="stat-number">{artistProjectsStats.total ?? 0}</div>
									<div className="stat-label">Total Projects</div>
								</div>
								<div className="stat-card pending">
									<div className="stat-number">{artistProjectsStats.pending ?? 0}</div>
									<div className="stat-label">Pending Review</div>
								</div>
								<div className="stat-card approved">
									<div className="stat-number">{artistProjectsStats.approved ?? 0}</div>
									<div className="stat-label">Approved</div>
								</div>
								<div className="stat-card rejected">
									<div className="stat-number">{artistProjectsStats.rejected ?? 0}</div>
									<div className="stat-label">Rejected</div>
								</div>
							</div>

							{/* Search and Filter Controls - UNCHANGED */}
							<div className="document-controls">
								<div className="search-section">
									<label>Search Projects</label>
									<div className="search-input-container">
										<input
											type="text"
											placeholder="Search by project name, symbol, artist name..."
											value={artistProjectsSearch}
											onChange={(e) => setArtistProjectsSearch(e.target.value)}
											className="search-input"
										/>
										<button
											className="search-btn"
											onClick={() => {
												setArtistProjectsPage(1);
												fetchArtistProjects(1, artistProjectsFilter, artistProjectsSearch);
											}}
										>
											<i className="fas fa-search"></i>
										</button>
									</div>
								</div>

								<div className="filter-section">
									<label>Filter by Status</label>
									<div className="filter-buttons">
										{['all', 'pending', 'approved', 'rejected'].map(status => (
											<button
												key={status}
												className={`filter-btn ${artistProjectsFilter === status ? 'active' : ''}`}
												onClick={() => {
													setArtistProjectsFilter(status);
													setArtistProjectsPage(1);
													fetchArtistProjects(1, status, artistProjectsSearch);
												}}
											>
												{status.charAt(0).toUpperCase() + status.slice(1)}
												{artistProjectsStats[status as keyof ArtistProjectsStats] !== undefined &&
													status !== 'all' && ` (${artistProjectsStats[status as keyof ArtistProjectsStats]})`
												}
											</button>
										))}
									</div>
								</div>
							</div>

							{/* Projects Table - SIMPLIFIED */}
							<div className="documents-table-container">
								{artistProjectsLoading ? (
									<div className="documents-loading">
										<p>Loading artist projects...</p>
									</div>
								) : artistProjects.length === 0 ? (
									<div className="no-documents">
										<div className="no-documents-icon">🎨</div>
										<h3>No Artist Projects Found</h3>
										<p>No projects match your current filters</p>
										<button
											className="reload-btn"
											onClick={() => {
												setArtistProjectsFilter('all');
												setArtistProjectsSearch('');
												setArtistProjectsPage(1);
												fetchArtistProjects(1, 'all', '');
											}}
										>
											<i className="fas fa-sync-alt"></i> Reload All Projects
										</button>
									</div>
								) : (
									<>
										<div className="documents-table artist-projects-table">
											{/* SIMPLIFIED TABLE HEADERS */}
											<div className="table-header">
												<div className="table-cell">Project Image</div>
												<div className="table-cell">Status</div>
												<div className="table-cell">Actions</div>
											</div>

											{artistProjects.map((project, index) => (
												<div key={project.id || index} className="table-row">
													{/* Project Image */}
													<div className="table-cell" data-label="Project Image">
														<div className="project-image-cell">
															{project.imageIpfsUrl ? (
																<img
																	src={project.imageIpfsUrl}
																	alt={project.projectName}
																	className="project-thumbnail"
																	onError={(e) => {
																		const target = e.target as HTMLImageElement;
																		target.style.display = 'none';
																		target.nextElementSibling?.classList.remove('hidden');
																	}}
																/>
															) : null}
															<div className="no-image-placeholder hidden">
																<i className="fas fa-image"></i>
																<span>No Image</span>
															</div>

														</div>
													</div>

													{/* Status */}
													<div className="table-cell" data-label="Status">
														<span className={`status-badge ${project.status}`}>
															{project.status?.charAt(0).toUpperCase() + project.status?.slice(1)}
														</span>
													</div>

													{/* Actions */}
													<div className="table-cell" data-label="Actions">
														<div className="action-buttons">
															{/* Details Button */}
															<button
																className="action-btn details-btn"
																onClick={() => setSelectedProject(project)}
																title="View Project Details"
															>
																<i className="fas fa-eye"></i>
																Details
															</button>

															{/* Contract Management for pending and approved projects */}
															{(project.status === 'pending' || project.status === 'approved') && (
																<AdminContractManagement
																	project={project}
																	onUpdate={() => {
																		fetchArtistProjects(artistProjectsPage, artistProjectsFilter, artistProjectsSearch);
																	}}
																/>
															)}
														</div>
													</div>
												</div>
											))}
										</div>

										{/* Pagination - UNCHANGED */}
										<div className="pagination-container">
											<div className="pagination-info">
												Showing {((artistProjectsPage - 1) * 10) + 1} to {Math.min(artistProjectsPage * 10, artistProjectsStats.total || 0)} of {artistProjectsStats.total} projects
											</div>

											<div className="pagination-controls">
												<button
													className="pagination-btn"
													onClick={() => {
														setArtistProjectsPage(1);
														fetchArtistProjects(1, artistProjectsFilter, artistProjectsSearch);
													}}
													disabled={artistProjectsPage === 1}
												>
													<i className="fas fa-angle-double-left"></i>
												</button>

												<button
													className="pagination-btn"
													onClick={() => {
														const newPage = artistProjectsPage - 1;
														setArtistProjectsPage(newPage);
														fetchArtistProjects(newPage, artistProjectsFilter, artistProjectsSearch);
													}}
													disabled={artistProjectsPage === 1}
												>
													<i className="fas fa-angle-left"></i>
												</button>

												<span className="pagination-current">
													Page {artistProjectsPage}
												</span>

												<button
													className="pagination-btn"
													onClick={() => {
														const newPage = artistProjectsPage + 1;
														setArtistProjectsPage(newPage);
														fetchArtistProjects(newPage, artistProjectsFilter, artistProjectsSearch);
													}}
													disabled={artistProjects.length < 10}
												>
													<i className="fas fa-angle-right"></i>
												</button>
											</div>
										</div>
									</>
								)}
							</div>

							{/* Project Details Modal */}
							{selectedProject && (
								<div className="modal-overlay" onClick={() => setSelectedProject(null)}>
									<div className="modal-content project-details-modal" onClick={(e) => e.stopPropagation()}>
										<div className="modal-header">
											<h3 className="modal-title">Project Details</h3>
											<button
												className="modal-close"
												onClick={() => setSelectedProject(null)}
											>
												<i className="fas fa-times"></i>
											</button>
										</div>

										<div className="modal-body">
											<div className="project-details-grid">
												{/* Project Image */}
												<div className="detail-section image-section">
													<h4>Project Image</h4>
													{selectedProject.imageIpfsUrl ? (
														<img
															src={selectedProject.imageIpfsUrl}
															alt={selectedProject.projectName}
															className="detail-image"
															onError={(e) => {
																const target = e.target as HTMLImageElement;
																target.src = '/placeholder-image.jpg';
															}}
														/>
													) : (
														<div className="no-image-large">
															<i className="fas fa-image"></i>
															<span>No Image Available</span>
														</div>
													)}
												</div>

												{/* Project Information */}
												<div className="detail-section info-section">
													<h4>Project Information</h4>
													<div className="detail-grid">
														<div className="detail-item">
															<label>Project Name:</label>
															<span className="detail-value">{selectedProject.projectName}</span>
														</div>
														<div className="detail-item">
															<label>Project Symbol:</label>
															<span className="detail-value symbol">{selectedProject.projectSymbol}</span>
														</div>
														<div className="detail-item">
															<label>Total Supply:</label>
															<span className="detail-value">{selectedProject.totalSupply?.toLocaleString()}</span>
														</div>
														<div className="detail-item">
															<label>Mint Price:</label>
															<span className="detail-value price">{selectedProject.mintPrice} POL</span>
														</div>
														<div className="detail-item">
															<label>Status:</label>
															<span className={`status-badge large ${selectedProject.status}`}>
																{selectedProject.status?.charAt(0).toUpperCase() + selectedProject.status?.slice(1)}
															</span>
														</div>
													</div>
												</div>

												{/* Artist Information */}
												<div className="detail-section artist-section">
													<h4>Artist Information</h4>
													<div className="detail-grid">
														<div className="detail-item">
															<label>Artist Name:</label>
															<span className="detail-value">{selectedProject.artistName}</span>
														</div>
														<div className="detail-item">
															<label>Artist Email:</label>
															<span className="detail-value email">{selectedProject.artistEmail}</span>
														</div>
														<div className="detail-item">
															<label>Artist ID:</label>
															<span className="detail-value id">{selectedProject.artistId}</span>
														</div>
													</div>
												</div>

												{/* Contract Information */}
												<div className="detail-section contract-section">
													<h4>Contract Information</h4>
													<div className="detail-grid">
														<div className="detail-item">
															<label>Contract Owner:</label>
															<div className="wallet-address-detail">
																<span className="address">{selectedProject.contractOwner}</span>
																<button
																	className="copy-btn"
																	onClick={() => {
																		navigator.clipboard.writeText(selectedProject.contractOwner);
																		// Add toast notification here if available
																		alert('Address copied to clipboard!');
																	}}
																	title="Copy address"
																>
																	<i className="fas fa-copy"></i>
																</button>
															</div>
														</div>
														{selectedProject.contractAddress && (
															<div className="detail-item">
																<label>Contract Address:</label>
																<div className="wallet-address-detail">
																	<span className="address">{selectedProject.contractAddress}</span>
																	<button
																		className="copy-btn"
																		onClick={() => {
																			navigator.clipboard.writeText(selectedProject.contractAddress);
																			alert('Contract address copied to clipboard!');
																		}}
																		title="Copy contract address"
																	>
																		<i className="fas fa-copy"></i>
																	</button>
																</div>
															</div>
														)}
														{selectedProject.networkId && (
															<div className="detail-item">
																<label>Network:</label>
																<span className="detail-value network">{selectedProject.networkId}</span>
															</div>
														)}
													</div>
												</div>

												{/* Dates */}
												<div className="detail-section dates-section">
													<h4>Timeline</h4>
													<div className="detail-grid">
														<div className="detail-item">
															<label>Created:</label>
															<span className="detail-value">
																{new Date(selectedProject.createdAt).toLocaleString()}
															</span>
														</div>
														<div className="detail-item">
															<label>Last Updated:</label>
															<span className="detail-value">
																{new Date(selectedProject.updatedAt).toLocaleString()}
															</span>
														</div>
														{selectedProject.rejectionReason && (
															<div className="detail-item full-width">
																<label>Rejection Reason:</label>
																<p className="rejection-reason">{selectedProject.rejectionReason}</p>
															</div>
														)}
													</div>
												</div>
											</div>
										</div>

										<div className="modal-footer">
											<button
												className="modal-btn secondary"
												onClick={() => setSelectedProject(null)}
											>
												Close
											</button>
											{(selectedProject.status === 'pending' || selectedProject.status === 'approved') && (
												<AdminContractManagement
													project={selectedProject}
													onUpdate={() => {
														setSelectedProject(null);
														fetchArtistProjects(artistProjectsPage, artistProjectsFilter, artistProjectsSearch);
													}}
												/>
											)}
										</div>
									</div>
								</div>
							)}
						</section>
					</div>
				);

			case 'identity':
				return (
					<div className="tab-content full-width">
						<section className="admin-form-group full-width">
							<h2 id="h2New">📄 Identity Document Management</h2>

							{/* Statistics Dashboard */}
							<div className="document-stats-dashboard">
								<div className="stat-card total">
									<div className="stat-number">{documentStats.total || 0}</div>
									<div className="stat-label">Total Documents</div>
								</div>
								<div className="stat-card pending">
									<div className="stat-number">{documentStats.pending || 0}</div>
									<div className="stat-label">Pending Review</div>
								</div>
								<div className="stat-card approved">
									<div className="stat-number">{documentStats.approved || 0}</div>
									<div className="stat-label">Approved</div>
								</div>
								<div className="stat-card rejected">
									<div className="stat-number">{documentStats.rejected || 0}</div>
									<div className="stat-label">Rejected</div>
								</div>
							</div>

							{/* Search and Filter Controls */}
							<div className="document-controls">
								<div className="search-section">
									<label>Search Documents</label>
									<div className="search-input-container">
										<input
											type="text"
											placeholder="Search by wallet address, user name, or email..."
											value={searchTerm}
											onChange={(e) => setSearchTerm(e.target.value)}
											className="search-input"
										/>

										<button
											className="search-btn"
											onClick={() => fetchDocuments(1, documentFilter, searchTerm)}
										>
											<i className="fas fa-search"></i>
										</button>
									</div>
								</div>

								<div className="filter-section">
									<label>Filter by Status</label>
									<div className="filter-buttons">
										{['all', 'pending', 'approved', 'rejected'].map(status => (
											<button
												key={status}
												className={`filter-btn ${documentFilter === status ? 'active' : ''}`}
												onClick={() => {
													setDocumentFilter(status);
													fetchDocuments(1, status, searchTerm);
												}}
											>
												{status.charAt(0).toUpperCase() + status.slice(1)}
												{artistProjectsStats[status as keyof ArtistProjectsStats] !== undefined && ` (${artistProjectsStats[status as keyof ArtistProjectsStats]})`}
											</button>
										))}
									</div>
								</div>

								<div className="per-page-section">
									<label>Per Page</label>
									<select
										value={documentsPerPage}
										onChange={(e) => {
											setDocumentsPerPage(parseInt(e.target.value));
											fetchDocuments(1, documentFilter, searchTerm);
										}}
										className="per-page-select"
									>
										<option value={5}>5</option>
										<option value={10}>10</option>
										<option value={25}>25</option>
										<option value={50}>50</option>
									</select>
								</div>
							</div>

							{/* Documents Table */}
							<div className="documents-table-container">
								{documents.length === 0 ? (
									<div className="no-documents">
										<div className="no-documents-icon">📋</div>
										<h3>No Documents Found</h3>
										<p>No documents match your current filters</p>
										<button
											className="reload-btn"
											onClick={() => {
												setDocumentFilter('all');
												setSearchTerm('');
												setCurrentPage(1);
												fetchDocuments(1, 'all', '');
											}}
										>
											<i className="fas fa-sync-alt"></i> Reload All Documents
										</button>
									</div>
								) : (
									<>
										<div className="documents-table">
											<div className="table-header">
												<div className="table-cell">Document Type</div>
												<div className="table-cell">User Name</div>
												<div className="table-cell">Wallet Address</div>
												<div className="table-cell">Upload Date</div>
												<div className="table-cell">Status</div>
												<div className="table-cell">Actions</div>
											</div>

											{documents.map((document, index) => (
												<div key={document.id || index} className="table-row">
													<div className="table-cell" data-label="Document Type">
														<div className="document-type-cell">
															<i className="fas fa-id-card"></i>
															<span>{formatDocumentType(document.documentType)}</span>
														</div>
													</div>

													<div className="table-cell" data-label="User Name">
														<div className="user-name-cell">
															<span className="user-name">
																{document.userName || 'Unknown'}
															</span>
														</div>
													</div>

													<div className="table-cell" data-label="Wallet Address">
														<div className="wallet-address-cell-container">
															<span className="wallet-address-cell">
																{document.walletAddress.substring(0, 8)}...{document.walletAddress.substring(34)}
															</span>
															<button
																className="copy-wallet-btn"
																onClick={() => handleCopyWallet(document.walletAddress)}
																title="Copy full wallet address"
															>
																{copiedWallet === document.walletAddress ? (
																	<i className="fas fa-check"></i>
																) : (
																	<i className="fas fa-copy"></i>
																)}
															</button>
														</div>
													</div>

													<div className="table-cell" data-label="Upload Date">
														<span className="date-cell">
															{new Date(document.uploadedAt).toLocaleDateString()}
														</span>
													</div>

													<div className="table-cell" data-label="Status">
														<span className={`status-badge ${document.verified ? 'approved' : document.rejectionReason ? 'rejected' : 'pending'}`}>
															{document.verified ? 'Approved' : document.rejectionReason ? 'Rejected' : 'Pending'}
														</span>
													</div>

													<div className="table-cell" data-label="Actions">
														<button
															className="review-btn"
															onClick={() => openDocumentModal(document)}
														>
															<i className="fas fa-eye"></i> Review
														</button>
													</div>
												</div>
											))}
										</div>

										{/* Pagination */}
										<div className="pagination-container">
											<div className="pagination-info">
												Showing {((currentPage - 1) * documentsPerPage) + 1} to {Math.min(currentPage * documentsPerPage, pagination.totalDocuments || 0)} of {pagination.totalDocuments} documents
											</div>

											<div className="pagination-controls">
												<button
													className="pagination-btn"
													onClick={() => fetchDocuments(1, documentFilter, searchTerm)}
													disabled={!pagination.hasPrevPage}
												>
													<i className="fas fa-angle-double-left"></i>
												</button>

												<button
													className="pagination-btn"
													onClick={() => fetchDocuments(currentPage - 1, documentFilter, searchTerm)}
													disabled={!pagination.hasPrevPage}
												>
													<i className="fas fa-angle-left"></i>
												</button>

												<span className="pagination-current">
													Page {currentPage} of {pagination.totalPages}
												</span>

												<button
													className="pagination-btn"
													onClick={() => fetchDocuments(currentPage + 1, documentFilter, searchTerm)}
													disabled={!pagination.hasNextPage}
												>
													<i className="fas fa-angle-right"></i>
												</button>

												<button
													className="pagination-btn"
													onClick={() => fetchDocuments(pagination.totalPages || 1, documentFilter, searchTerm)}
													disabled={!pagination.hasNextPage}
												>
													<i className="fas fa-angle-double-right"></i>
												</button>
											</div>
										</div>
									</>
								)}
							</div>
						</section>
					</div>
				);

			case 'taxid':
				return (
					<div className="tab-content full-width">
						<section className="admin-form-group full-width">
							<h2 id="h2New">🧾 Tax ID Document Management</h2>

							{/* Statistics Dashboard */}
							{/* Statistics Dashboard */}
							<div className="document-stats-dashboard">
								<div className="stat-card total">
									<div className="stat-number">{artistProjectsStats.total ?? 0}</div>
									<div className="stat-label">Total Projects</div>
								</div>
								<div className="stat-card pending">
									<div className="stat-number">{artistProjectsStats.pending ?? 0}</div>
									<div className="stat-label">Pending Review</div>
								</div>
								<div className="stat-card approved">
									<div className="stat-number">{artistProjectsStats.approved ?? 0}</div>
									<div className="stat-label">Approved</div>
								</div>
								<div className="stat-card rejected">
									<div className="stat-number">{artistProjectsStats.rejected ?? 0}</div>
									<div className="stat-label">Rejected</div>
								</div>
							</div>

							{/* Search and Filter Controls */}
							<div className="document-controls">
								<div className="search-section">
									<label>Search Tax ID Documents</label>
									<div className="search-input-container">
										<input
											type="text"
											placeholder="Search by wallet address, user name, or email..."
											value={taxIdSearchTerm}
											onChange={(e) => setTaxIdSearchTerm(e.target.value)}
											className="search-input"
										/>
										<button
											className="search-btn"
											onClick={() => fetchTaxIdDocuments(1, taxIdFilter, taxIdSearchTerm)}
										>
											<i className="fas fa-search"></i>
										</button>
									</div>
								</div>

								<div className="filter-section">
									<label>Filter by Status</label>
									<div className="filter-buttons">
										{['all', 'pending', 'approved', 'rejected'].map(status => (
											<button
												key={status}
												className={`filter-btn ${taxIdFilter === status ? 'active' : ''}`}
												onClick={() => {
													setTaxIdFilter(status);
													fetchTaxIdDocuments(1, status, taxIdSearchTerm);
												}}
											>
												{status.charAt(0).toUpperCase() + status.slice(1)}
												{taxIdStats[status as keyof DocumentStats] !== undefined && ` (${taxIdStats[status as keyof DocumentStats]})`}
											</button>
										))}
									</div>
								</div>

								<div className="per-page-section">
									<label>Per Page</label>
									<select
										value={documentsPerPage}
										onChange={(e) => {
											setDocumentsPerPage(parseInt(e.target.value));
											fetchTaxIdDocuments(1, taxIdFilter, taxIdSearchTerm);
										}}
										className="per-page-select"
									>
										<option value={5}>5</option>
										<option value={10}>10</option>
										<option value={25}>25</option>
										<option value={50}>50</option>
									</select>
								</div>
							</div>

							{/* Tax ID Documents Table */}
							<div className="documents-table-container">
								{taxIdDocuments.length === 0 ? (
									<div className="no-documents">
										<div className="no-documents-icon">🧾</div>
										<h3>No Tax ID Documents Found</h3>
										<p>No tax ID documents match your current filters</p>
										<button
											className="reload-btn"
											onClick={() => {
												setTaxIdFilter('all');
												setTaxIdSearchTerm('');
												setTaxIdCurrentPage(1);
												fetchTaxIdDocuments(1, 'all', '');
											}}
										>
											<i className="fas fa-sync-alt"></i> Reload All Tax ID Documents
										</button>
									</div>
								) : (
									<>
										<div className="documents-table">
											<div className="table-header">
												<div className="table-cell">Document Type</div>
												<div className="table-cell">User Name</div>
												<div className="table-cell">Wallet Address</div>
												<div className="table-cell">Upload Date</div>
												<div className="table-cell">Status</div>
												<div className="table-cell">Actions</div>
											</div>

											{taxIdDocuments.map((document, index) => (
												<div key={document.id || index} className="table-row">
													<div className="table-cell" data-label="Document Type">
														<div className="document-type-cell">
															<i className="fas fa-file-invoice-dollar"></i>
															<span>{formatTaxIdType(document.taxIdType)}</span>
														</div>
													</div>

													<div className="table-cell" data-label="User Name">
														<div className="user-name-cell">
															<span className="user-name">
																{document.userName || 'Unknown'}
															</span>
														</div>
													</div>

													<div className="table-cell" data-label="Wallet Address">
														<div className="wallet-address-cell-container">
															<span className="wallet-address-cell">
																{document.walletAddress.substring(0, 8)}...{document.walletAddress.substring(34)}
															</span>
															<button
																className="copy-wallet-btn"
																onClick={() => handleCopyWallet(document.walletAddress)}
																title="Copy full wallet address"
															>
																{copiedWallet === document.walletAddress ? (
																	<i className="fas fa-check"></i>
																) : (
																	<i className="fas fa-copy"></i>
																)}
															</button>
														</div>
													</div>

													<div className="table-cell" data-label="Upload Date">
														<span className="date-cell">
															{new Date(document.uploadedAt).toLocaleDateString()}
														</span>
													</div>

													<div className="table-cell" data-label="Status">
														<span className={`status-badge ${document.verified ? 'approved' : document.rejectionReason ? 'rejected' : 'pending'}`}>
															{document.verified ? 'Approved' : document.rejectionReason ? 'Rejected' : 'Pending'}
														</span>
													</div>

													<div className="table-cell" data-label="Actions">
														<button
															className="review-btn"
															onClick={() => {
																setSelectedTaxIdDocument(document);
																setShowTaxIdModal(true);
															}}
														>
															<i className="fas fa-eye"></i> Review
														</button>
													</div>
												</div>
											))}

										</div>

										{/* Pagination */}
										<div className="pagination-container">
											<div className="pagination-info">
												Showing {((taxIdCurrentPage - 1) * documentsPerPage) + 1} to {Math.min(taxIdCurrentPage * documentsPerPage, taxIdPagination.totalDocuments || 0)} of {taxIdPagination.totalDocuments} tax ID documents
											</div>

											<div className="pagination-controls">
												<button
													className="pagination-btn"
													onClick={() => fetchTaxIdDocuments(1, taxIdFilter, taxIdSearchTerm)}
													disabled={!taxIdPagination.hasPrevPage}
												>
													<i className="fas fa-angle-double-left"></i>
												</button>

												<button
													className="pagination-btn"
													onClick={() => fetchTaxIdDocuments(taxIdCurrentPage - 1, taxIdFilter, taxIdSearchTerm)}
													disabled={!taxIdPagination.hasPrevPage}
												>
													<i className="fas fa-angle-left"></i>
												</button>

												<span className="pagination-current">
													Page {taxIdCurrentPage} of {taxIdPagination.totalPages}
												</span>

												<button
													className="pagination-btn"
													onClick={() => fetchTaxIdDocuments(taxIdCurrentPage + 1, taxIdFilter, taxIdSearchTerm)}
													disabled={!taxIdPagination.hasNextPage}
												>
													<i className="fas fa-angle-right"></i>
												</button>

												<button
													className="pagination-btn"
													onClick={() => fetchTaxIdDocuments(taxIdPagination.totalPages || 1, taxIdFilter, taxIdSearchTerm)}
													disabled={!taxIdPagination.hasNextPage}
												>
													<i className="fas fa-angle-double-right"></i>
												</button>
											</div>
										</div>
									</>
								)}
							</div>
						</section>
					</div>
				);

			case 'royalty':
				return (
					<div className="tab-content full-width">
						<div className="contract-settings-container">
							<section className="admin-section royalty-settings">
								<h2 id="h2New">💰 Royalty Management</h2>

								{/* Set New Disbursement */}
								<div className="airdrop-input-group">
									<label>Disbursement Amount ($)</label>
									<input
										type="number"
										step="0.01"
										min="0"
										max="100000"
										className="airdrop-input"
										value={newPayoutLimit}
										onChange={(e) => setNewPayoutLimit(e.target.value)}
										placeholder="Enter disbursement amount (e.g., 10000)"
										disabled={isUpdatingLimits}
									/>
								</div>

								<div className="airdrop-input-group">
									<label>Disbursement Period - From Date</label>
									<input
										type="date"
										className="airdrop-input"
										value={disbursementFromDate}
										onChange={(e) => setDisbursementFromDate(e.target.value)}
										disabled={isUpdatingLimits}
										required
									/>
								</div>

								<div className="airdrop-input-group">
									<label>Disbursement Period - To Date</label>
									<input
										type="date"
										className="airdrop-input"
										value={disbursementToDate}
										onChange={(e) => setDisbursementToDate(e.target.value)}
										disabled={isUpdatingLimits}
										required
									/>
								</div>

								<div className="airdrop-input-group">
									<label>Project Name</label>
									<input
										type="text"
										className="airdrop-input"
										value={projectName}
										onChange={(e) => setProjectName(e.target.value)}
										placeholder="Enter project name (e.g., Hope KK NFT, Music Royalties)"
										disabled={isUpdatingLimits}
									/>
								</div>

								<div className="airdrop-input-group">
									<label>Comments (Optional)</label>
									<textarea
										className="airdrop-input"
										value={disbursementComments}
										onChange={(e) => setDisbursementComments(e.target.value)}
										placeholder="Add comments about this disbursement..."
										rows={3} // Change from rows="3" to rows={3}
										disabled={isUpdatingLimits}
									/>
								</div>

								{/* Action Buttons */}
								<div className="limits-actions">
									<button
										onClick={handleSetPayoutLimit}
										className="admin-submit-btn"
										disabled={isUpdatingLimits || !newPayoutLimit || !disbursementFromDate || !disbursementToDate}
										style={{ backgroundColor: '#28a745', borderColor: '#28a745', marginRight: '10px' }}
									>
										{isUpdatingLimits ? (
											<>
												<i className="fas fa-spinner fa-spin"></i> Processing...
											</>
										) : (
											<>
												<i className="fas fa-check"></i> Set Disbursement
											</>
										)}
									</button>

									{payoutLimits.isSet && (
										<button
											onClick={handleResetPayoutLimits}
											className="admin-submit-btn"
											disabled={isUpdatingLimits}
											style={{ backgroundColor: '#ffc107', borderColor: '#ffc107' }}
										>
											{isUpdatingLimits ? (
												<>
													<i className="fas fa-spinner fa-spin"></i> Resetting...
												</>
											) : (
												<>
													<i className="fas fa-redo"></i> Reset Used Amount
												</>
											)}
										</button>
									)}
								</div>

								{/* Instructions */}
								<div className="limits-instructions" style={{
									padding: '15px',
									marginTop: '15px',
									backgroundColor: '#f8f9fa',
									border: '1px solid #dee2e6',
									borderRadius: '5px'
								}}>
									<h4>💡 How Disbursements Work:</h4>
									<ul>
										<li><strong>Disbursement Amount:</strong> Total amount available for user withdrawals in this period</li>
										<li><strong>Period:</strong> Time frame for this disbursement (quarterly or monthly)</li>
										<li><strong>Comments:</strong> Internal notes about this disbursement</li>
										<li><strong>Reset:</strong> Resets the "Used" amount back to 0 without changing the total limit</li>
										<li><strong>Security:</strong> Prevents unlimited withdrawals and helps manage cash flow</li>
									</ul>

									<div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#fff3cd', borderRadius: '5px' }}>
										<strong>⚠️ Important:</strong> Users cannot withdraw if limits are not set or if the remaining limit is $0.
									</div>
								</div>
							</section>

							<section className="admin-section disbursement-records">
								<h2>Disbursement History</h2>

								{/* Search and Filter Controls */}
								<div className="disbursement-controls">
									<div className="search-section">
										<label>Search Records</label>
										<div className="search-input-container">
											<input
												type="text"
												placeholder="Search by period, comments..."
												value={disbursementSearchTerm}
												onChange={(e) => setDisbursementSearchTerm(e.target.value)}
												className="search-input"
											/>
											<button
												className="search-btn"
												onClick={() => fetchDisbursementHistory(1, disbursementSearchTerm)}
											>
												<i className="fas fa-search"></i>
											</button>
										</div>
									</div>

									<div className="per-page-section">
										<label>Per Page</label>
										<select
											value={disbursementPerPage}
											onChange={(e) => {
												setDisbursementPerPage(parseInt(e.target.value));
												fetchDisbursementHistory(1, disbursementSearchTerm);
											}}
											className="per-page-select"
										>
											<option value={5}>5</option>
											<option value={10}>10</option>
											<option value={25}>25</option>
										</select>
									</div>
								</div>

								{/* Disbursement Records Table */}
								<div className="disbursement-table-container">
									{isLoadingDisbursements ? (
										<div className="documents-loading">
											<p>Loading disbursement records...</p>
										</div>
									) : disbursementHistory.length === 0 ? (
										<div className="no-documents">
											<div className="no-documents-icon">💰</div>
											<h3>No Disbursement Records</h3>
											<p>No disbursement records found</p>
											<button
												className="reload-btn"
												onClick={() => {
													setDisbursementSearchTerm('');
													setDisbursementCurrentPage(1);
													fetchDisbursementHistory(1, '');
												}}
											>
												<i className="fas fa-sync-alt"></i> Reload All Records
											</button>
										</div>
									) : (
										<>
											<div className="disbursement-table">
												<div className="table-header">
													<div className="table-cell">Date</div>
													<div className="table-cell">Period (From - To)</div>
													<div className="table-cell">Amount ($)</div>
													<div className="table-cell">Status</div>
													<div className="table-cell">Comments</div>
												</div>

												{disbursementHistory.map((record, index) => (
													<div key={record.id || index} className="table-row">
														<div className="table-cell">
															<span className="date-cell">
																{new Date(record.createdAt).toLocaleDateString()}
															</span>
														</div>

														<div className="table-cell">
															<span className="period-cell">
																{record.fromDate && record.toDate ?
																	`${new Date(record.fromDate).toLocaleDateString()} - ${new Date(record.toDate).toLocaleDateString()}` :
																	'N/A'
																}
															</span>
														</div>
														<div className="table-cell">
															<span className="amount-cell">
																${record.totalLimit?.toLocaleString() || '0'}
															</span>
														</div>

														<div className="table-cell">
															<span className={`status-badge ${record.isActive ? 'active' : 'inactive'}`}>
																{record.isActive ? 'Active' : 'Completed'}
															</span>
														</div>

														<div className="table-cell">
															<span className="comments-cell" title={record.comments}>
																{record.comments ? (record.comments.length > 30 ? record.comments.substring(0, 30) + '...' : record.comments) : 'No comments'}
															</span>
														</div>
													</div>
												))}
											</div>

											{/* Pagination */}
											{disbursementPagination.totalPages && disbursementPagination.totalPages > 1 && (
												<div className="pagination-container">
													<div className="pagination-info">
														Showing {((disbursementCurrentPage - 1) * disbursementPerPage) + 1} to {Math.min(disbursementCurrentPage * disbursementPerPage, disbursementPagination.totalRecords || 0)} of {disbursementPagination.totalRecords} records
													</div>

													<div className="pagination-controls">
														<button
															className="pagination-btn"
															onClick={() => fetchDisbursementHistory(1, disbursementSearchTerm)}
															disabled={!disbursementPagination.hasPrevPage}
														>
															<i className="fas fa-angle-double-left"></i>
														</button>

														<button
															className="pagination-btn"
															onClick={() => fetchDisbursementHistory(disbursementCurrentPage - 1, disbursementSearchTerm)}
															disabled={!disbursementPagination.hasPrevPage}
														>
															<i className="fas fa-angle-left"></i>
														</button>

														<span className="pagination-current">
															Page {disbursementCurrentPage} of {disbursementPagination.totalPages}
														</span>

														<button
															className="pagination-btn"
															onClick={() => fetchDisbursementHistory(disbursementCurrentPage + 1, disbursementSearchTerm)}
															disabled={!disbursementPagination.hasNextPage}
														>
															<i className="fas fa-angle-right"></i>
														</button>

														<button
															className="pagination-btn"
															onClick={() => fetchDisbursementHistory(disbursementPagination.totalPages || 1, disbursementSearchTerm)}
															disabled={!disbursementPagination.hasNextPage}
														>
															<i className="fas fa-angle-double-right"></i>
														</button>
													</div>
												</div>
											)}
										</>
									)}
								</div>

								{/* Summary Statistics */}
								<div className="disbursement-summary" style={{
									padding: '15px',
									marginTop: '20px',
									backgroundColor: '#f8f9fa',
									border: '1px solid #dee2e6',
									borderRadius: '5px'
								}}>
									<h4>📊 Summary Statistics:</h4>
									<div className="summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
										<div>
											<strong>Total Disbursements:</strong> {disbursementStats.totalDisbursements || 0}
										</div>
										<div>
											<strong>Total Amount Disbursed:</strong> ${disbursementStats.totalAmountDisbursed?.toLocaleString() || '0'}
										</div>
										<div>
											<strong>Total Amount Used:</strong> ${disbursementStats.totalAmountUsed?.toLocaleString() || '0'}
										</div>
										<div>
											<strong>Active Disbursements:</strong> {disbursementStats.activeDisbursements || 0}
										</div>
									</div>
								</div>
							</section>
						</div>
					</div>
				);

			case 'payout':
				return (
					<div className="tab-content full-width">
						<section className="admin-form-group full-width">
							<h2 id="h2New">💳 Payout Status Management</h2>

							{/* Enhanced Search Section */}
							<div className="enhanced-search-section">
								<div className="search-method-selector">
									<label>Search By:</label>
									<div className="search-method-buttons">
										<button
											className={`method-btn ${payoutSearchMethod === 'wallet' ? 'active' : ''}`}
											onClick={() => {
												setPayoutSearchMethod('wallet');
												setPayoutSearchValue('');
												setPayoutSearchResults([]);
												setSelectedUserForPayout(null);
											}}
										>
											<i className="fas fa-wallet"></i> Wallet Address
										</button>
										<button
											className={`method-btn ${payoutSearchMethod === 'name' ? 'active' : ''}`}
											onClick={() => {
												setPayoutSearchMethod('name');
												setPayoutSearchValue('');
												setPayoutSearchResults([]);
												setSelectedUserForPayout(null);
											}}
										>
											<i className="fas fa-user"></i> Name
										</button>
										<button
											className={`method-btn ${payoutSearchMethod === 'email' ? 'active' : ''}`}
											onClick={() => {
												setPayoutSearchMethod('email');
												setPayoutSearchValue('');
												setPayoutSearchResults([]);
												setSelectedUserForPayout(null);
											}}
										>
											<i className="fas fa-envelope"></i> Email
										</button>
									</div>
								</div>

								<div className="airdrop-input-group">
									<label>
										{payoutSearchMethod === 'wallet' ? 'Wallet Address' :
											payoutSearchMethod === 'name' ? 'User Name' : 'Email Address'}
									</label>
									<div className="search-input-container">
										<input
											type="text"
											className="airdrop-input"
											value={payoutSearchValue}
											onChange={(e) => setPayoutSearchValue(e.target.value)}
											placeholder={
												payoutSearchMethod === 'wallet' ? '0x123...' :
													payoutSearchMethod === 'name' ? 'Enter user name...' :
														'Enter email address...'
											}
											disabled={isRefreshingPayouts || isSearchingUsers}
										/>
										<button
											className="search-btn"
											onClick={handleSearchUsers}
											disabled={isRefreshingPayouts || isSearchingUsers || !payoutSearchValue.trim()}
										>
											{isSearchingUsers ? (
												<i className="fas fa-spinner fa-spin"></i>
											) : (
												<i className="fas fa-search"></i>
											)}
										</button>
									</div>
								</div>

								{/* Search Results */}
								{payoutSearchResults.length > 0 && (
									<div className="search-results-container">
										<h4>Search Results ({payoutSearchResults.length} found):</h4>
										<div className="search-results-grid">
											{payoutSearchResults.map((user, index) => (
												<div
													key={user.walletAddress || index}
													className={`user-result-card ${selectedUserForPayout?.walletAddress === user.walletAddress ? 'selected' : ''}`}
													onClick={() => {
														console.log('User selected:', user);
														setSelectedUserForPayout(user);
													}}
												>
													<div className="user-info">
														<div className="user-name">
															<i className="fas fa-user"></i>
															<strong>{user.name || 'Anonymous'}</strong>
														</div>
														<div className="user-email">
															<i className="fas fa-envelope"></i>
															{user.email || 'No email'}
														</div>
														<div className="user-wallet">
															<i className="fas fa-wallet"></i>
															<span className="wallet-short">
																{user.walletAddress ?
																	`${user.walletAddress.substring(0, 8)}...${user.walletAddress.substring(34)}` :
																	'No wallet'
																}
															</span>
														</div>
														<div className="user-tokens">
															<i className="fas fa-coins"></i>
															{user.totalMinted || 0} tokens
														</div>
													</div>
													{selectedUserForPayout?.walletAddress === user.walletAddress && (
														<div className="selected-indicator">
															<i className="fas fa-check-circle"></i>
														</div>
													)}
												</div>
											))}
										</div>
									</div>
								)}

							</div>

							{/* Refresh Status Button */}
							<button
								onClick={handleRefreshPayoutStatus}
								className="admin-submit-btn"
								disabled={
									isRefreshingPayouts ||
									!selectedUserForPayout ||
									!selectedUserForPayout.walletAddress ||
									selectedUserForPayout.walletAddress.trim() === ''
								}
								style={{ backgroundColor: '#17a2b8', borderColor: '#17a2b8' }}
							>
								{isRefreshingPayouts ? (
									<>
										<i className="fas fa-spinner fa-spin"></i> Checking Status...
									</>
								) : (
									<>
										<i className="fas fa-sync-alt"></i> Refresh Payout Status
									</>
								)}
							</button>

							{refreshResults && (
								<div className="refresh-results" style={{
									padding: '15px',
									marginTop: '15px',
									backgroundColor: '#f8f9fa',
									border: '1px solid #dee2e6',
									borderRadius: '5px'
								}}>
									<h4>Refresh Results:</h4>
									<pre>{JSON.stringify(refreshResults, null, 2)}</pre>
								</div>
							)}

							<p className="airdrop-note">
								Search for users by name, email, or wallet address, then refresh their payout status with PayPal.
								Use this when users report their withdrawals are stuck as "pending".
							</p>

							<div className="payout-instructions" style={{
								padding: '15px',
								marginTop: '15px',
								backgroundColor: '#f8f9fa',
								border: '1px solid #dee2e6',
								borderRadius: '5px'
							}}>
								<h4>💡 How Enhanced Payout Status Works:</h4>
								<ul>
									<li><strong>Multi-Search:</strong> Find users by name, email, or wallet address</li>
									<li><strong>User Selection:</strong> Click on a user card to select them for status refresh</li>
									<li><strong>Status Check:</strong> Queries PayPal for the latest status of pending payouts</li>
									<li><strong>Database Sync:</strong> Updates the local database with PayPal's records</li>
									<li><strong>Issue Resolution:</strong> Helps resolve stuck or delayed payout statuses</li>
								</ul>

								<div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#d1ecf1', borderRadius: '5px' }}>
									<strong>ℹ️ Note:</strong> Only use this for users with reported payout issues. Frequent checking may trigger rate limits.
								</div>
							</div>
						</section>
					</div>
				);

			default:
				return <div>Tab not found</div>;
		}
	};

	return (
		<div className="admin-container">
			<header className="admin-header">
				<h1>MuseCoinX Admin Panel</h1>
				<div className="wallet-info">
					<ConnectButton.Custom>
						{({ openConnectModal, account }) => {
							const connected = !!account;

							return connected ? (
								<button
									className="connect-wallet-btn"
									onClick={disconnectWallet}
								>
									<i className="fas fa-wallet"></i> {shortenAddress(account.address)}
								</button>
							) : (
								<button
									className="connect-wallet-btn"
									onClick={openConnectModal}
								>
									<i className="fas fa-wallet"></i> Connect Wallet
								</button>
							);
						}}
					</ConnectButton.Custom>
				</div>
			</header>

			{/* Tab Navigation */}
			<div className="admin-tabs">
				<div className="tab-nav">
					{tabs.map(tab => (
						<button
							key={tab.id}
							className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
							onClick={() => setActiveTab(tab.id)}
						>
							<span className="tab-icon">{tab.icon}</span>
							<span className="tab-label">{tab.label}</span>
						</button>
					))}
				</div>
			</div>

			{renderTabContent()}

			{/* Notification */}
			{notification && (
				<div>
					<div className={`notificationA ${notification.type}`}>
						{notification.message}
					</div>
				</div>
			)}

			{/* Tax ID Document Review Modal */}
			{showTaxIdModal && selectedTaxIdDocument && (
				<div className="document-modal-overlay">
					<div className="document-modal">
						<div className="document-modal-header">
							<h3>Review Tax ID Document</h3>
							<button
								className="close-modal-btn"
								onClick={() => {
									setShowTaxIdModal(false);
									setSelectedTaxIdDocument(null);
								}}
								style={{
									position: 'absolute',
									right: '15px',
									top: '15px',
									background: 'none',
									border: 'none',
									fontSize: '20px',
									cursor: 'pointer',
									color: '#666'
								}}
							>
								✕
							</button>
						</div>

						<div className="document-modal-body">
							<div className="document-details">
								<div className="detail-row">
									<strong>Document Type:</strong>
									<span>{formatTaxIdType(selectedTaxIdDocument.taxIdType)}</span>
								</div>
								<div className="detail-row">
									<strong>Wallet Address:</strong>
									<span className="wallet-address">{selectedTaxIdDocument.walletAddress}</span>
								</div>
								<div className="detail-row">
									<strong>Upload Date:</strong>
									<span>{new Date(selectedTaxIdDocument.uploadedAt).toLocaleString()}</span>
								</div>
								{selectedTaxIdDocument.rejectionReason && (
									<div className="detail-row">
										<strong>Previous Rejection:</strong>
										<span className="rejection-reason">{selectedTaxIdDocument.rejectionReason}</span>
									</div>
								)}
							</div>

							<div className="document-image-container">
								<img
									src={selectedTaxIdDocument.ipfsUrl}
									alt="Tax ID Document"
									className="document-image"
									onError={(e) => {
										const target = e.target as HTMLImageElement;
										target.style.display = 'none';
										const nextSibling = target.nextElementSibling as HTMLElement;
										if (nextSibling) {
											nextSibling.style.display = 'block';
										}
									}}
								/>
								<div className="image-error" style={{ display: 'none' }}>
									<i className="fas fa-exclamation-triangle"></i>
									<p>Unable to load tax ID document image</p>
									<a href={selectedTaxIdDocument.ipfsUrl} target="_blank" rel="noopener noreferrer">
										View in new tab
									</a>
								</div>
							</div>

							<div className="document-verification-guidelines">
								<h4>Tax ID Verification Guidelines:</h4>
								<ul>
									<li>✓ Document should be clear and readable</li>
									<li>✓ Tax identification numbers should be visible</li>
									<li>✓ No glare or shadows obscuring text</li>
									<li>✓ Document should appear authentic</li>
									<li>✓ Personal information can be partially redacted for security</li>
								</ul>
							</div>
						</div>

						<div className="document-modal-footer">
							<button
								className="reject-btn"
								onClick={() => {
									setShowTaxIdModal(false);
									setShowTaxIdRejectionModal(true);
								}}
								disabled={isVerifyingTaxId}
							>
								<i className="fas fa-times-circle"></i>
								Reject Document
							</button>
							<button
								className="approve-btn"
								onClick={() => handleVerifyTaxIdDocument(selectedTaxIdDocument.walletAddress, true)}
								disabled={isVerifyingTaxId}
							>
								{isVerifyingTaxId ? (
									<><i className="fas fa-spinner fa-spin"></i> Processing...</>
								) : (
									<><i className="fas fa-check-circle"></i> Approve Document</>
								)}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Tax ID Rejection Reason Modal */}
			{showTaxIdRejectionModal && selectedTaxIdDocument && (
				<div className="document-modal-overlay">
					<div className="rejection-modal">
						<div className="document-modal-header">
							<h3>Reject Tax ID Document</h3>
							<button
								className="close-modal-btn"
								onClick={() => {
									setShowTaxIdRejectionModal(false);
									setTaxIdRejectionReason('');
								}}
								style={{
									position: 'absolute',
									right: '15px',
									top: '15px',
									background: 'none',
									border: 'none',
									fontSize: '20px',
									cursor: 'pointer',
									color: 'white'
								}}
							>
								✕
							</button>
						</div>

						<div className="document-modal-body">
							<p>Please provide a reason for rejecting this tax ID document:</p>
							<textarea
								className="rejection-textarea"
								value={taxIdRejectionReason}
								onChange={(e) => setTaxIdRejectionReason(e.target.value)}
								placeholder="Enter reason for rejection (e.g., Document is unclear, Invalid document type, etc.)"
								disabled={isVerifyingTaxId}
								rows={4}
							/>
						</div>

						<div className="document-modal-footer">
							<button
								className="cancel-btn"
								onClick={() => {
									setShowTaxIdRejectionModal(false);
									setTaxIdRejectionReason('');
								}}
								disabled={isVerifyingTaxId}
							>
								Cancel
							</button>
							<button
								className="confirm-reject-btn"
								onClick={() => {
									if (!taxIdRejectionReason.trim()) {
										showNotification('Please provide a rejection reason', 'error');
										return;
									}
									handleVerifyTaxIdDocument(selectedTaxIdDocument.walletAddress, false, taxIdRejectionReason.trim());
								}}
								disabled={isVerifyingTaxId || !taxIdRejectionReason.trim()}
							>
								{isVerifyingTaxId ? (
									<><i className="fas fa-spinner fa-spin"></i> Processing...</>
								) : (
									<><i className="fas fa-ban"></i> Confirm Rejection</>
								)}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Identity Document Review Modal */}
			{showDocumentModal && selectedDocument && (
				<div className="document-modal-overlay">
					<div className="document-modal enhanced-modal">
						<div className="document-modal-header">
							<h3>Review Identity Document</h3>
							<button
								className="close-modal-btn"
								onClick={() => {
									setShowDocumentModal(false);
									setSelectedDocument(null);
								}}
								style={{
									position: 'absolute',
									right: '15px',
									top: '15px',
									background: 'none',
									border: 'none',
									fontSize: '20px',
									cursor: 'pointer',
									color: 'white'
								}}
							>
								✕
							</button>
						</div>

						<div className="document-modal-body">
							<div className="document-details">
								<div className="detail-row">
									<strong>Document Type:</strong>
									<span>{formatDocumentType(selectedDocument.documentType)}</span>
								</div>
								<div className="detail-row">
									<strong>Wallet Address:</strong>
									<span className="wallet-address">{selectedDocument.walletAddress}</span>
								</div>
								<div className="detail-row">
									<strong>Upload Date:</strong>
									<span>{new Date(selectedDocument.uploadedAt).toLocaleString()}</span>
								</div>
								<div className="detail-row">
									<strong>Images Provided:</strong>
									<span className="images-info">
										<span className="image-indicator front">
											<i className="fas fa-image"></i> Front
										</span>
										{selectedDocument.hasBackImage && (
											<span className="image-indicator back">
												<i className="fas fa-image"></i> Back
											</span>
										)}
										{!selectedDocument.hasBackImage && (
											<span className="image-indicator missing">
												<i className="fas fa-times"></i> Back (Not provided)
											</span>
										)}
									</span>
								</div>
								{selectedDocument.rejectionReason && (
									<div className="detail-row">
										<strong>Previous Rejection:</strong>
										<span className="rejection-reason">{selectedDocument.rejectionReason}</span>
									</div>
								)}
							</div>

							{/* Enhanced Image Container for Front and Back */}
							<div className="document-images-container">
								{/* Front Image */}
								<div className="document-image-section">
									<h4 className="image-section-title">
										<i className="fas fa-image"></i> Front Side
									</h4>
									<div className="document-image-wrapper">
										<img
											src={selectedDocument.frontImageUrl || selectedDocument.ipfsUrl}
											alt="Front side of identity document"
											className="document-image"
											onError={(e) => {
												const target = e.target as HTMLImageElement;
												target.style.display = 'none';
												const nextSibling = target.nextElementSibling as HTMLElement;
												if (nextSibling) {
													nextSibling.style.display = 'block';
												}
											}}
										/>
										<div className="image-error" style={{ display: 'none' }}>
											<i className="fas fa-exclamation-triangle"></i>
											<p>Unable to load front image</p>
											<a
												href={selectedDocument.frontImageUrl || selectedDocument.ipfsUrl}
												target="_blank"
												rel="noopener noreferrer"
												className="view-link"
											>
												<i className="fas fa-external-link-alt"></i> View in new tab
											</a>
										</div>
									</div>
								</div>

								{/* Back Image (if available) */}
								{selectedDocument.hasBackImage && selectedDocument.backImageUrl ? (
									<div className="document-image-section">
										<h4 className="image-section-title">
											<i className="fas fa-image"></i> Back Side
										</h4>
										<div className="document-image-wrapper">
											<img
												src={selectedDocument.backImageUrl}
												alt="Back side of identity document"
												className="document-image"
												onError={(e) => {
													const target = e.target as HTMLImageElement;
													target.style.display = 'none';
													const nextSibling = target.nextElementSibling as HTMLElement;
													if (nextSibling) {
														nextSibling.style.display = 'block';
													}
												}}
											/>
											<div className="image-error" style={{ display: 'none' }}>
												<i className="fas fa-exclamation-triangle"></i>
												<p>Unable to load back image</p>
												<a
													href={selectedDocument.backImageUrl}
													target="_blank"
													rel="noopener noreferrer"
													className="view-link"
												>
													<i className="fas fa-external-link-alt"></i> View in new tab
												</a>
											</div>
										</div>
									</div>
								) : (
									<div className="document-image-section missing-image">
										<h4 className="image-section-title">
											<i className="fas fa-image"></i> Back Side
										</h4>
										<div className="no-back-image">
											<i className="fas fa-times-circle"></i>
											<p>Back side image not provided</p>
											<small>This may be acceptable for some document types</small>
										</div>
									</div>
								)}
							</div>

							<div className="document-verification-guidelines">
								<h4>Verification Guidelines:</h4>
								<div className="guidelines-grid">
									<div className="guideline-column">
										<h5>Front Side Requirements:</h5>
										<ul>
											<li>✓ Document should be clear and readable</li>
											<li>✓ All four corners should be visible</li>
											<li>✓ No glare or shadows obscuring text</li>
											<li>✓ Photo and personal details visible</li>
										</ul>
									</div>
									<div className="guideline-column">
										<h5>Back Side Requirements:</h5>
										<ul>
											<li>✓ Additional security features visible (if applicable)</li>
											<li>✓ Barcodes/magnetic strips clear (if present)</li>
											<li>✓ Address information readable (if present)</li>
											<li>⚠️ Not required for all document types</li>
										</ul>
									</div>
								</div>

								<div className="document-type-notes">
									<strong>Document Type Notes:</strong>
									<ul>
										<li><strong>Passport:</strong> Back side typically not required</li>
										<li><strong>Driver's License:</strong> Back side recommended</li>
										<li><strong>National ID:</strong> Back side may be required depending on country</li>
									</ul>
								</div>
							</div>
						</div>

						<div className="document-modal-footer">
							<button
								className="reject-btn"
								onClick={handleRejectClick}
								disabled={isVerifying}
							>
								<i className="fas fa-times-circle"></i>
								Reject Document
							</button>
							<button
								className="approve-btn"
								onClick={() => handleVerifyDocument(selectedDocument.walletAddress, true)}
								disabled={isVerifying}
							>
								{isVerifying ? (
									<><i className="fas fa-spinner fa-spin"></i> Processing...</>
								) : (
									<><i className="fas fa-check-circle"></i> Approve Document</>
								)}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Rejection Reason Modal */}
			{showRejectionModal && selectedDocument && (
				<div className="document-modal-overlay">
					<div className="rejection-modal">
						<div className="document-modal-header">
							<h3>Reject Document</h3>
							<button
								className="close-modal-btn"
								onClick={() => {
									setShowRejectionModal(false);
									setRejectionReason('');
								}}
								style={{
									position: 'absolute',
									right: '15px',
									top: '15px',
									background: 'none',
									border: 'none',
									fontSize: '20px',
									cursor: 'pointer',
									color: 'white'
								}}
							>
								✕
							</button>
						</div>

						<div className="document-modal-body">
							<p>Please provide a reason for rejecting this document:</p>
							<textarea
								className="rejection-textarea"
								value={rejectionReason}
								onChange={(e) => setRejectionReason(e.target.value)}
								placeholder="Enter reason for rejection (e.g., Document is blurry, Expired document, etc.)"
								disabled={isVerifying}
								rows={4}
							/>
						</div>

						<div className="document-modal-footer">
							<button
								className="cancel-btn"
								onClick={() => {
									setShowRejectionModal(false);
									setRejectionReason('');
								}}
								disabled={isVerifying}
							>
								Cancel
							</button>
							<button
								className="confirm-reject-btn"
								onClick={handleRejectSubmit}
								disabled={isVerifying || !rejectionReason.trim()}
							>
								{isVerifying ? (
									<><i className="fas fa-spinner fa-spin"></i> Processing...</>
								) : (
									<><i className="fas fa-ban"></i> Confirm Rejection</>
								)}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default AdminPanel;
