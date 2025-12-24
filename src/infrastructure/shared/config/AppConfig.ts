import { parseEnv, Config } from "./envSchema.js";

export function loadConfig(): Config {
  // DEV_WALLET_PRIVATE_KEY: read before validation, then clear from process.env
  // This prevents the key from being accessible via process.env after startup
  const devPrivateKey = process.env.DEV_WALLET_PRIVATE_KEY;

  if (devPrivateKey) {
    delete process.env.DEV_WALLET_PRIVATE_KEY;
  }

  // Validate all environment variables using zod schema
  // (includes forbidden vars check for production)
  const config = parseEnv(process.env);

  // Restore devPrivateKey to config (it was cleared from process.env before validation)
  if (config.isDev && devPrivateKey) {
    config.dcaWallet.devPrivateKey = devPrivateKey;
  }

  return config;
}
