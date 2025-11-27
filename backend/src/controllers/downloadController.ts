import { Request, Response } from 'express';
import { generateBlobSASToken, blobExists, CONTAINERS } from '../config/azureBlobStorage';
import { VsixDownload } from '../models';
import { HTTP_STATUS } from '../config/constants';
import { asyncHandler } from '../middleware/errorHandler';

/**
 * Download VSIX file
 * GET /api/download/vsix
 * Query: ?version=1.0.0 (optional)
 */
export const downloadVsix = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const version = (req.query.version as string) || '1.0.0';
    const blobName = `accesslint-v${version}.vsix`;

    // Check if blob exists
    const exists = await blobExists(CONTAINERS.VSIX, blobName);
    if (!exists) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
            error: `VSIX version ${version} not found`
        });
        return;
    }

    // Generate SAS token (1 hour expiry)
    const sasUrl = await generateBlobSASToken(CONTAINERS.VSIX, blobName, 60);

    // Track download
    await VsixDownload.create({
        userId,
        vsixVersion: version,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
    });

    res.status(HTTP_STATUS.OK).json({
        data: {
            downloadUrl: sasUrl,
            version,
            expiresIn: 3600 // seconds
        }
    });
});

/**
 * Get available VSIX versions
 * GET /api/download/versions
 */
export const getVersions = asyncHandler(async (req: Request, res: Response) => {
    // For now, return a static list
    // In production, you'd list blobs from storage
    const versions = [
        { version: '0.1.0', releaseDate: '2024-11-27', size: '15MB' }
    ];

    res.status(HTTP_STATUS.OK).json({
        data: { versions }
    });
});

export default {
    downloadVsix,
    getVersions
};

