import { ContainerClient } from '@azure/storage-blob';
/**
 * Initialize Blob Storage client
 */
export declare function initializeBlobStorage(): Promise<void>;
/**
 * Get container client
 */
export declare function getContainerClient(containerName: string): ContainerClient;
/**
 * Upload a file to blob storage
 */
export declare function uploadBlob(containerName: string, blobName: string, content: Buffer | string, contentType?: string): Promise<string>;
/**
 * Download a blob from storage
 */
export declare function downloadBlob(containerName: string, blobName: string): Promise<Buffer>;
/**
 * Generate SAS token for blob download
 */
export declare function generateBlobSASToken(containerName: string, blobName: string, expiryMinutes?: number): Promise<string>;
/**
 * Check if blob exists
 */
export declare function blobExists(containerName: string, blobName: string): Promise<boolean>;
/**
 * Delete a blob
 */
export declare function deleteBlob(containerName: string, blobName: string): Promise<void>;
/**
 * List blobs in a container
 */
export declare function listBlobs(containerName: string, prefix?: string): Promise<string[]>;
export declare const CONTAINERS: {
    VSIX: string;
    REPORTS: string;
    UPLOADS: string;
};
declare const _default: {
    initializeBlobStorage: typeof initializeBlobStorage;
    getContainerClient: typeof getContainerClient;
    uploadBlob: typeof uploadBlob;
    downloadBlob: typeof downloadBlob;
    generateBlobSASToken: typeof generateBlobSASToken;
    blobExists: typeof blobExists;
    deleteBlob: typeof deleteBlob;
    listBlobs: typeof listBlobs;
    CONTAINERS: {
        VSIX: string;
        REPORTS: string;
        UPLOADS: string;
    };
};
export default _default;
//# sourceMappingURL=azureBlobStorage.d.ts.map