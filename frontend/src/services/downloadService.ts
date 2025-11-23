import api from './api';

/**
 * Get VSIX download URL
 */
export const getVsixDownloadUrl = async (version?: string): Promise<{
  downloadUrl: string;
  version: string;
  expiresIn: number;
}> => {
  const params = version ? { version } : {};
  const response = await api.get('/download/vsix', { params });
  return response.data.data;
};

/**
 * Get available versions
 */
export const getAvailableVersions = async () => {
  const response = await api.get('/download/versions');
  return response.data.data.versions;
};

export default {
  getVsixDownloadUrl,
  getAvailableVersions
};

