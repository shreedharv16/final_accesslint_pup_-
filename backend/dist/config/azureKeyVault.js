"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSecret = getSecret;
exports.getSecrets = getSecrets;
exports.validateSecrets = validateSecrets;
const keyvault_secrets_1 = require("@azure/keyvault-secrets");
const identity_1 = require("@azure/identity");
const dotenv_1 = __importDefault(require("dotenv"));
const logger_1 = __importDefault(require("../utils/logger"));
dotenv_1.default.config();
const { KEY_VAULT_URL, NODE_ENV } = process.env;
// Azure Key Vault client (only in production)
let secretClient = null;
if (NODE_ENV === 'production' && KEY_VAULT_URL) {
    try {
        const credential = new identity_1.DefaultAzureCredential();
        secretClient = new keyvault_secrets_1.SecretClient(KEY_VAULT_URL, credential);
        logger_1.default.info('✅ Azure Key Vault client initialized');
    }
    catch (error) {
        logger_1.default.error('❌ Failed to initialize Azure Key Vault:', error);
    }
}
/**
 * Get a secret from Azure Key Vault (production) or environment variables (development)
 */
async function getSecret(secretName) {
    try {
        // In production, fetch from Key Vault
        if (NODE_ENV === 'production' && secretClient) {
            const secret = await secretClient.getSecret(secretName);
            return secret.value;
        }
        // In development, use environment variables
        const envVarName = secretName.toUpperCase().replace(/-/g, '_');
        return process.env[envVarName];
    }
    catch (error) {
        logger_1.default.error(`❌ Error fetching secret '${secretName}':`, error);
        return undefined;
    }
}
/**
 * Get multiple secrets at once
 */
async function getSecrets(secretNames) {
    const secrets = {};
    await Promise.all(secretNames.map(async (name) => {
        secrets[name] = await getSecret(name);
    }));
    return secrets;
}
/**
 * Validate that all required secrets are available
 */
async function validateSecrets(requiredSecrets) {
    const secrets = await getSecrets(requiredSecrets);
    const missing = [];
    for (const [name, value] of Object.entries(secrets)) {
        if (!value) {
            missing.push(name);
        }
    }
    if (missing.length > 0) {
        logger_1.default.error(`❌ Missing required secrets: ${missing.join(', ')}`);
        return false;
    }
    logger_1.default.info('✅ All required secrets validated');
    return true;
}
exports.default = {
    getSecret,
    getSecrets,
    validateSecrets
};
//# sourceMappingURL=azureKeyVault.js.map