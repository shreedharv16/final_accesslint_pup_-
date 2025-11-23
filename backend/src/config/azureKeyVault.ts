import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';
import dotenv from 'dotenv';
import logger from '../utils/logger';

dotenv.config();

const { KEY_VAULT_URL, NODE_ENV } = process.env;

// Azure Key Vault client (only in production)
let secretClient: SecretClient | null = null;

if (NODE_ENV === 'production' && KEY_VAULT_URL) {
    try {
        const credential = new DefaultAzureCredential();
        secretClient = new SecretClient(KEY_VAULT_URL, credential);
        logger.info('✅ Azure Key Vault client initialized');
    } catch (error) {
        logger.error('❌ Failed to initialize Azure Key Vault:', error);
    }
}

/**
 * Get a secret from Azure Key Vault (production) or environment variables (development)
 */
export async function getSecret(secretName: string): Promise<string | undefined> {
    try {
        // In production, fetch from Key Vault
        if (NODE_ENV === 'production' && secretClient) {
            const secret = await secretClient.getSecret(secretName);
            return secret.value;
        }

        // In development, use environment variables
        const envVarName = secretName.toUpperCase().replace(/-/g, '_');
        return process.env[envVarName];
    } catch (error) {
        logger.error(`❌ Error fetching secret '${secretName}':`, error);
        return undefined;
    }
}

/**
 * Get multiple secrets at once
 */
export async function getSecrets(secretNames: string[]): Promise<Record<string, string | undefined>> {
    const secrets: Record<string, string | undefined> = {};

    await Promise.all(
        secretNames.map(async (name) => {
            secrets[name] = await getSecret(name);
        })
    );

    return secrets;
}

/**
 * Validate that all required secrets are available
 */
export async function validateSecrets(requiredSecrets: string[]): Promise<boolean> {
    const secrets = await getSecrets(requiredSecrets);
    const missing: string[] = [];

    for (const [name, value] of Object.entries(secrets)) {
        if (!value) {
            missing.push(name);
        }
    }

    if (missing.length > 0) {
        logger.error(`❌ Missing required secrets: ${missing.join(', ')}`);
        return false;
    }

    logger.info('✅ All required secrets validated');
    return true;
}

export default {
    getSecret,
    getSecrets,
    validateSecrets
};

