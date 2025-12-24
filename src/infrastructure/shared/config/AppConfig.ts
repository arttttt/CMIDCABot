import { parseEnv, Config } from "./envSchema.js";

/**
 * MED-004: Environment variables that are forbidden in production mode.
 * These variables are for development only and may contain sensitive data
 * or change bot behavior in ways that are unsafe for production.
 */
const FORBIDDEN_IN_PRODUCTION = [
  "DEV_WALLET_PRIVATE_KEY", // Development wallet private key - security risk
  "DB_MODE", // Should be only sqlite in production
];

export function loadConfig(): Config {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const isDev = nodeEnv !== "production";

  // MED-004: Block dangerous env vars in production
  if (!isDev) {
    const foundForbidden: string[] = [];

    for (const envVar of FORBIDDEN_IN_PRODUCTION) {
      if (process.env[envVar]) {
        foundForbidden.push(envVar);
      }
    }

    if (foundForbidden.length > 0) {
      console.error("─".repeat(50));
      console.error("FATAL: Forbidden environment variables detected in production!");
      console.error("─".repeat(50));
      console.error("The following variables must NOT be set in production:");
      for (const v of foundForbidden) {
        console.error(`  - ${v}`);
      }
      console.error("");
      console.error("These variables are for development only and pose security risks.");
      console.error("Remove them from your environment and restart.");
      console.error("─".repeat(50));
      process.exit(1);
    }
  }

  // DEV_WALLET_PRIVATE_KEY: read before validation, then clear from process.env
  const devPrivateKey = process.env.DEV_WALLET_PRIVATE_KEY;

  // MED-004: Clear sensitive dev variable from process.env after reading
  if (devPrivateKey) {
    delete process.env.DEV_WALLET_PRIVATE_KEY;
  }

  // Validate all environment variables using zod schema
  const config = parseEnv(process.env);

  // Restore devPrivateKey to config (it was cleared from process.env before validation)
  if (isDev && devPrivateKey) {
    config.dcaWallet.devPrivateKey = devPrivateKey;
  }

  return config;
}
