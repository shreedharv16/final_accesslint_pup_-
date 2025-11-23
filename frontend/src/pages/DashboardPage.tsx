import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getVsixDownloadUrl, getAvailableVersions } from '../services/downloadService';
import { getUserUsage } from '../services/authService';

interface UsageStats {
  requestsToday: number;
  requestsThisHour: number;
  tokensUsedToday: number;
  rateLimitPerHour: number;
  rateLimitTokensPerDay: number;
}

const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [versions, setVersions] = useState<string[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [loadingUsage, setLoadingUsage] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [usageData, versionsData] = await Promise.all([
        getUserUsage(),
        getAvailableVersions()
      ]);
      
      setUsage(usageData);
      setVersions(versionsData);
      setSelectedVersion(versionsData[0] || ''); // Default to latest
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err);
      setError('Failed to load usage statistics');
    } finally {
      setLoadingUsage(false);
    }
  };

  const handleDownload = async () => {
    setError('');
    setDownloading(true);

    try {
      const { downloadUrl, version } = await getVsixDownloadUrl(selectedVersion || undefined);
      
      // Create a temporary anchor element to trigger download
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `accesslint-${version}.vsix`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Refresh usage stats after download
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (loadingUsage) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-primary-600">AccessLint</h1>
              <p className="text-sm text-gray-600">Accessibility Testing Tool</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.email}</p>
                <p className="text-xs text-gray-500">
                  Joined {new Date(user?.createdAt || '').toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Download Section */}
          <div className="lg:col-span-2">
            <div className="card">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Download AccessLint VSIX</h2>
                  <p className="text-sm text-gray-600">Install the extension in VS Code</p>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Version
                  </label>
                  <select
                    value={selectedVersion}
                    onChange={(e) => setSelectedVersion(e.target.value)}
                    className="input-field"
                  >
                    {versions.map((version) => (
                      <option key={version} value={version}>
                        {version} {version === versions[0] ? '(Latest)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleDownload}
                  disabled={downloading || !selectedVersion}
                  className="btn-primary w-full"
                >
                  {downloading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Downloading...
                    </span>
                  ) : (
                    'Download VSIX'
                  )}
                </button>
              </div>

              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">Installation Instructions</h3>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>Download the VSIX file using the button above</li>
                  <li>Open VS Code</li>
                  <li>Go to Extensions (Ctrl+Shift+X)</li>
                  <li>Click the "..." menu → Install from VSIX</li>
                  <li>Select the downloaded .vsix file</li>
                  <li>Reload VS Code when prompted</li>
                </ol>
              </div>

              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h3 className="text-sm font-semibold text-yellow-900 mb-2">Prerequisites</h3>
                <p className="text-sm text-yellow-800">
                  Before using AccessLint, ensure you have the following installed:
                </p>
                <ul className="text-sm text-yellow-800 mt-2 space-y-1 list-disc list-inside">
                  <li>Node.js (v18 or higher)</li>
                  <li>Playwright: Run <code className="bg-yellow-100 px-1 rounded">npx playwright install chromium</code></li>
                  <li>NVDA screen reader (Windows only)</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Usage Stats Section */}
          <div className="space-y-6">
            {/* Rate Limits Card */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Rate Limits</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Requests this hour</span>
                    <span className="font-medium">
                      {usage?.requestsThisHour || 0} / {usage?.rateLimitPerHour || 0}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, ((usage?.requestsThisHour || 0) / (usage?.rateLimitPerHour || 1)) * 100)}%`
                      }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Tokens today</span>
                    <span className="font-medium">
                      {usage?.tokensUsedToday?.toLocaleString() || 0} / {usage?.rateLimitTokensPerDay?.toLocaleString() || 0}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, ((usage?.tokensUsedToday || 0) / (usage?.rateLimitTokensPerDay || 1)) * 100)}%`
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Activity</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Total Requests</span>
                  <span className="text-lg font-semibold text-gray-900">{usage?.requestsToday || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Tokens Used</span>
                  <span className="text-lg font-semibold text-gray-900">
                    {usage?.tokensUsedToday?.toLocaleString() || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Help Card */}
            <div className="card bg-primary-50 border-primary-200">
              <h3 className="text-lg font-semibold text-primary-900 mb-2">Need Help?</h3>
              <p className="text-sm text-primary-800 mb-3">
                Check out our documentation for guides and troubleshooting tips.
              </p>
              <button className="text-sm text-primary-700 hover:text-primary-800 font-medium">
                View Documentation →
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;

