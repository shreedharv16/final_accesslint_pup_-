/**
 * Get a secret from Azure Key Vault (production) or environment variables (development)
 */
export declare function getSecret(secretName: string): Promise<string | undefined>;
/**
 * Get multiple secrets at once
 */
export declare function getSecrets(secretNames: string[]): Promise<Record<string, string | undefined>>;
/**
 * Validate that all required secrets are available
 */
export declare function validateSecrets(requiredSecrets: string[]): Promise<boolean>;
declare const _default: {
    getSecret: typeof getSecret;
    getSecrets: typeof getSecrets;
    validateSecrets: typeof validateSecrets;
};
export default _default;
//# sourceMappingURL=azureKeyVault.d.ts.map