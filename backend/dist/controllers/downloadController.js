"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVersions = exports.downloadVsix = void 0;
const azureBlobStorage_1 = require("../config/azureBlobStorage");
const models_1 = require("../models");
const constants_1 = require("../config/constants");
const errorHandler_1 = require("../middleware/errorHandler");
/**
 * Download VSIX file
 * GET /api/download/vsix
 * Query: ?version=1.0.0 (optional)
 */
exports.downloadVsix = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user.id;
    const version = req.query.version || '1.0.0';
    const blobName = `accesslint-v${version}.vsix`;
    // Check if blob exists
    const exists = await (0, azureBlobStorage_1.blobExists)(azureBlobStorage_1.CONTAINERS.VSIX, blobName);
    if (!exists) {
        res.status(constants_1.HTTP_STATUS.NOT_FOUND).json({
            error: `VSIX version ${version} not found`
        });
        return;
    }
    // Generate SAS token (1 hour expiry)
    const sasUrl = await (0, azureBlobStorage_1.generateBlobSASToken)(azureBlobStorage_1.CONTAINERS.VSIX, blobName, 60);
    // Track download
    await models_1.VsixDownload.create({
        userId,
        vsixVersion: version,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
    });
    res.status(constants_1.HTTP_STATUS.OK).json({
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
exports.getVersions = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    // For now, return a static list
    // In production, you'd list blobs from storage
    const versions = [
        { version: '1.0.0', releaseDate: '2024-01-01', size: '200MB' }
    ];
    res.status(constants_1.HTTP_STATUS.OK).json({
        data: { versions }
    });
});
exports.default = {
    downloadVsix: exports.downloadVsix,
    getVersions: exports.getVersions
};
//# sourceMappingURL=downloadController.js.map