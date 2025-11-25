"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONTAINERS = void 0;
exports.initializeBlobStorage = initializeBlobStorage;
exports.getContainerClient = getContainerClient;
exports.uploadBlob = uploadBlob;
exports.downloadBlob = downloadBlob;
exports.generateBlobSASToken = generateBlobSASToken;
exports.blobExists = blobExists;
exports.deleteBlob = deleteBlob;
exports.listBlobs = listBlobs;
const storage_blob_1 = require("@azure/storage-blob");
const dotenv_1 = __importDefault(require("dotenv"));
const logger_1 = __importDefault(require("../utils/logger"));
const azureKeyVault_1 = require("./azureKeyVault");
dotenv_1.default.config();
const { BLOB_STORAGE_ACCOUNT = '', BLOB_CONTAINER_VSIX = 'vsix-files', BLOB_CONTAINER_REPORTS = 'test-reports', BLOB_CONTAINER_UPLOADS = 'user-uploads', NODE_ENV = 'development' } = process.env;
let blobServiceClient = null;
let storageAccountKey = null;
/**
 * Initialize Blob Storage client
 */
async function initializeBlobStorage() {
    try {
        // Get storage account key from Key Vault or environment
        storageAccountKey = await (0, azureKeyVault_1.getSecret)('BLOB-STORAGE-KEY') || process.env.BLOB_STORAGE_KEY || '';
        if (!storageAccountKey) {
            throw new Error('Blob Storage key not found');
        }
        const connectionString = `DefaultEndpointsProtocol=https;AccountName=${BLOB_STORAGE_ACCOUNT};AccountKey=${storageAccountKey};EndpointSuffix=core.windows.net`;
        blobServiceClient = storage_blob_1.BlobServiceClient.fromConnectionString(connectionString);
        logger_1.default.info('✅ Azure Blob Storage client initialized');
        logger_1.default.info(`📦 Storage Account: ${BLOB_STORAGE_ACCOUNT}`);
    }
    catch (error) {
        logger_1.default.error('❌ Failed to initialize Azure Blob Storage:', error);
        throw error;
    }
}
/**
 * Get container client
 */
function getContainerClient(containerName) {
    if (!blobServiceClient) {
        throw new Error('Blob Storage client not initialized');
    }
    return blobServiceClient.getContainerClient(containerName);
}
/**
 * Upload a file to blob storage
 */
async function uploadBlob(containerName, blobName, content, contentType) {
    try {
        const containerClient = getContainerClient(containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        const options = contentType ? { blobHTTPHeaders: { blobContentType: contentType } } : undefined;
        await blockBlobClient.upload(content, Buffer.byteLength(content), options);
        logger_1.default.info(`✅ Uploaded blob: ${blobName} to container: ${containerName}`);
        return blockBlobClient.url;
    }
    catch (error) {
        logger_1.default.error(`❌ Error uploading blob '${blobName}':`, error);
        throw error;
    }
}
/**
 * Download a blob from storage
 */
async function downloadBlob(containerName, blobName) {
    try {
        const containerClient = getContainerClient(containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        const downloadResponse = await blockBlobClient.download(0);
        const chunks = [];
        if (downloadResponse.readableStreamBody) {
            for await (const chunk of downloadResponse.readableStreamBody) {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
        }
        return Buffer.concat(chunks);
    }
    catch (error) {
        logger_1.default.error(`❌ Error downloading blob '${blobName}':`, error);
        throw error;
    }
}
/**
 * Generate SAS token for blob download
 */
async function generateBlobSASToken(containerName, blobName, expiryMinutes = 60) {
    try {
        if (!storageAccountKey) {
            throw new Error('Storage account key not available');
        }
        const sharedKeyCredential = new storage_blob_1.StorageSharedKeyCredential(BLOB_STORAGE_ACCOUNT, storageAccountKey);
        const containerClient = getContainerClient(containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        const expiryDate = new Date();
        expiryDate.setMinutes(expiryDate.getMinutes() + expiryMinutes);
        const sasToken = (0, storage_blob_1.generateBlobSASQueryParameters)({
            containerName,
            blobName,
            permissions: storage_blob_1.BlobSASPermissions.parse('r'), // Read-only
            startsOn: new Date(),
            expiresOn: expiryDate
        }, sharedKeyCredential).toString();
        const sasUrl = `${blockBlobClient.url}?${sasToken}`;
        logger_1.default.info(`✅ Generated SAS token for blob: ${blobName} (expires in ${expiryMinutes} min)`);
        return sasUrl;
    }
    catch (error) {
        logger_1.default.error(`❌ Error generating SAS token for '${blobName}':`, error);
        throw error;
    }
}
/**
 * Check if blob exists
 */
async function blobExists(containerName, blobName) {
    try {
        const containerClient = getContainerClient(containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        return await blockBlobClient.exists();
    }
    catch (error) {
        logger_1.default.error(`❌ Error checking blob existence '${blobName}':`, error);
        return false;
    }
}
/**
 * Delete a blob
 */
async function deleteBlob(containerName, blobName) {
    try {
        const containerClient = getContainerClient(containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        await blockBlobClient.delete();
        logger_1.default.info(`✅ Deleted blob: ${blobName}`);
    }
    catch (error) {
        logger_1.default.error(`❌ Error deleting blob '${blobName}':`, error);
        throw error;
    }
}
/**
 * List blobs in a container
 */
async function listBlobs(containerName, prefix) {
    try {
        const containerClient = getContainerClient(containerName);
        const blobNames = [];
        const options = prefix ? { prefix } : undefined;
        for await (const blob of containerClient.listBlobsFlat(options)) {
            blobNames.push(blob.name);
        }
        logger_1.default.info(`✅ Listed ${blobNames.length} blobs in container: ${containerName}`);
        return blobNames;
    }
    catch (error) {
        logger_1.default.error(`❌ Error listing blobs in container '${containerName}':`, error);
        throw error;
    }
}
// Container constants
exports.CONTAINERS = {
    VSIX: BLOB_CONTAINER_VSIX,
    REPORTS: BLOB_CONTAINER_REPORTS,
    UPLOADS: BLOB_CONTAINER_UPLOADS
};
exports.default = {
    initializeBlobStorage,
    getContainerClient,
    uploadBlob,
    downloadBlob,
    generateBlobSASToken,
    blobExists,
    deleteBlob,
    listBlobs,
    CONTAINERS: exports.CONTAINERS
};
//# sourceMappingURL=azureBlobStorage.js.map