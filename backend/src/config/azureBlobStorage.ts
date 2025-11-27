import { BlobServiceClient, ContainerClient, generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } from '@azure/storage-blob';
import dotenv from 'dotenv';
import logger from '../utils/logger';
import { getSecret } from './azureKeyVault';

dotenv.config();

const {
    AZURE_STORAGE_ACCOUNT_NAME = '',
    AZURE_STORAGE_ACCOUNT_KEY = '',
    AZURE_STORAGE_CONTAINER_VSIX = 'vsix',
    AZURE_STORAGE_CONTAINER_REPORTS = 'reports',
    AZURE_STORAGE_CONTAINER_UPLOADS = 'uploads',
    NODE_ENV = 'development'
} = process.env;

let blobServiceClient: BlobServiceClient | null = null;
let storageAccountKey: string | null = null;

/**
 * Initialize Blob Storage client
 */
export async function initializeBlobStorage(): Promise<void> {
    try {
        // Use storage account key from environment
        storageAccountKey = AZURE_STORAGE_ACCOUNT_KEY;

        if (!storageAccountKey || !AZURE_STORAGE_ACCOUNT_NAME) {
            throw new Error('Blob Storage account name or key not found');
        }

        const connectionString = `DefaultEndpointsProtocol=https;AccountName=${AZURE_STORAGE_ACCOUNT_NAME};AccountKey=${storageAccountKey};EndpointSuffix=core.windows.net`;
        
        blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);

        logger.info('✅ Azure Blob Storage client initialized');
        logger.info(`📦 Storage Account: ${AZURE_STORAGE_ACCOUNT_NAME}`);
    } catch (error) {
        logger.error('❌ Failed to initialize Azure Blob Storage:', error);
        throw error;
    }
}

/**
 * Get container client
 */
export function getContainerClient(containerName: string): ContainerClient {
    if (!blobServiceClient) {
        throw new Error('Blob Storage client not initialized');
    }
    return blobServiceClient.getContainerClient(containerName);
}

/**
 * Upload a file to blob storage
 */
export async function uploadBlob(
    containerName: string,
    blobName: string,
    content: Buffer | string,
    contentType?: string
): Promise<string> {
    try {
        const containerClient = getContainerClient(containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);

        const options = contentType ? { blobHTTPHeaders: { blobContentType: contentType } } : undefined;

        await blockBlobClient.upload(content, Buffer.byteLength(content), options);

        logger.info(`✅ Uploaded blob: ${blobName} to container: ${containerName}`);

        return blockBlobClient.url;
    } catch (error) {
        logger.error(`❌ Error uploading blob '${blobName}':`, error);
        throw error;
    }
}

/**
 * Download a blob from storage
 */
export async function downloadBlob(containerName: string, blobName: string): Promise<Buffer> {
    try {
        const containerClient = getContainerClient(containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);

        const downloadResponse = await blockBlobClient.download(0);
        const chunks: Buffer[] = [];

        if (downloadResponse.readableStreamBody) {
            for await (const chunk of downloadResponse.readableStreamBody) {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
        }

        return Buffer.concat(chunks);
    } catch (error) {
        logger.error(`❌ Error downloading blob '${blobName}':`, error);
        throw error;
    }
}

/**
 * Generate SAS token for blob download
 */
export async function generateBlobSASToken(
    containerName: string,
    blobName: string,
    expiryMinutes: number = 60
): Promise<string> {
    try {
        if (!storageAccountKey) {
            throw new Error('Storage account key not available');
        }

        const sharedKeyCredential = new StorageSharedKeyCredential(
            AZURE_STORAGE_ACCOUNT_NAME,
            storageAccountKey
        );

        const containerClient = getContainerClient(containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);

        const expiryDate = new Date();
        expiryDate.setMinutes(expiryDate.getMinutes() + expiryMinutes);

        const sasToken = generateBlobSASQueryParameters(
            {
                containerName,
                blobName,
                permissions: BlobSASPermissions.parse('r'), // Read-only
                startsOn: new Date(),
                expiresOn: expiryDate
            },
            sharedKeyCredential
        ).toString();

        const sasUrl = `${blockBlobClient.url}?${sasToken}`;

        logger.info(`✅ Generated SAS token for blob: ${blobName} (expires in ${expiryMinutes} min)`);

        return sasUrl;
    } catch (error) {
        logger.error(`❌ Error generating SAS token for '${blobName}':`, error);
        throw error;
    }
}

/**
 * Check if blob exists
 */
export async function blobExists(containerName: string, blobName: string): Promise<boolean> {
    try {
        const containerClient = getContainerClient(containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        return await blockBlobClient.exists();
    } catch (error) {
        logger.error(`❌ Error checking blob existence '${blobName}':`, error);
        return false;
    }
}

/**
 * Delete a blob
 */
export async function deleteBlob(containerName: string, blobName: string): Promise<void> {
    try {
        const containerClient = getContainerClient(containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        await blockBlobClient.delete();
        logger.info(`✅ Deleted blob: ${blobName}`);
    } catch (error) {
        logger.error(`❌ Error deleting blob '${blobName}':`, error);
        throw error;
    }
}

/**
 * List blobs in a container
 */
export async function listBlobs(containerName: string, prefix?: string): Promise<string[]> {
    try {
        const containerClient = getContainerClient(containerName);
        const blobNames: string[] = [];

        const options = prefix ? { prefix } : undefined;

        for await (const blob of containerClient.listBlobsFlat(options)) {
            blobNames.push(blob.name);
        }

        logger.info(`✅ Listed ${blobNames.length} blobs in container: ${containerName}`);
        return blobNames;
    } catch (error) {
        logger.error(`❌ Error listing blobs in container '${containerName}':`, error);
        throw error;
    }
}

// Container constants
export const CONTAINERS = {
    VSIX: AZURE_STORAGE_CONTAINER_VSIX,
    REPORTS: AZURE_STORAGE_CONTAINER_REPORTS,
    UPLOADS: AZURE_STORAGE_CONTAINER_UPLOADS
};

export default {
    initializeBlobStorage,
    getContainerClient,
    uploadBlob,
    downloadBlob,
    generateBlobSASToken,
    blobExists,
    deleteBlob,
    listBlobs,
    CONTAINERS
};

