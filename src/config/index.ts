import { Config, DatabaseMode, PriceSource, AuthConfig, HealthConfig } from "../types/config.js";

/**
 * MED-004: Environment variables that are forbidden in production mode.
 * These variables are for development only and may contain sensitive data
 * or change bot behavior in ways that are unsafe for production.
 */
const FORBIDDEN_IN_PRODUCTION = [
  "DEV_WALLET_PRIVATE_KEY", // Development wallet private key - security risk
  "DB_MODE", // Should be only sqlite in production
];

function getEnvOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvOrDefault(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

function getEnvBool(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

function getEnvInt(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

export function loadConfig(): Config {
  const nodeEnv = getEnvOrDefault("NODE_ENV", "development");
  const isDev = nodeEnv !== "production";
  const webEnabled = getEnvBool("WEB_ENABLED", false);

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

  // DEV_WALLET_PRIVATE_KEY is optional, only used in dev mode
  const devPrivateKey = process.env.DEV_WALLET_PRIVATE_KEY || undefined;

  // MED-004: Clear sensitive dev variable from process.env after reading
  if (devPrivateKey) {
    delete process.env.DEV_WALLET_PRIVATE_KEY;
  }

  // MASTER_ENCRYPTION_KEY is required for encrypting private keys
  const masterEncryptionKey = getEnvOrThrow("MASTER_ENCRYPTION_KEY");

  // OWNER_TELEGRAM_ID is required for authorization
  const ownerTelegramId = getEnvInt("OWNER_TELEGRAM_ID", 0);
  if (ownerTelegramId === 0) {
    throw new Error("Missing required environment variable: OWNER_TELEGRAM_ID");
  }

  const auth: AuthConfig = {
    ownerTelegramId,
    dbPath: getEnvOrDefault("AUTH_DATABASE_PATH", "./data/auth.db"),
  };

  const health: HealthConfig = {
    port: getEnvInt("HEALTH_PORT", 8000),
    host: getEnvOrDefault("HEALTH_HOST", "0.0.0.0"),
  };

  // Validate RPC URL uses HTTPS in production (LOW-002)
  const rpcUrl = getEnvOrDefault("SOLANA_RPC_URL", "https://api.devnet.solana.com");
  if (!isDev && !rpcUrl.startsWith("https://")) {
    throw new Error(
      "SOLANA_RPC_URL must use HTTPS in production. " +
        "Current value starts with: " +
        rpcUrl.substring(0, 10) +
        "...",
    );
  }

  return {
    telegram: {
      // Bot token is optional when running in web-only mode
      botToken: webEnabled
        ? getEnvOrDefault("TELEGRAM_BOT_TOKEN", "")
        : getEnvOrThrow("TELEGRAM_BOT_TOKEN"),
    },
    solana: {
      rpcUrl,
    },
    database: {
      mode: getEnvOrDefault("DB_MODE", "sqlite") as DatabaseMode,
      path: getEnvOrDefault("DATABASE_PATH", "./data/bot.db"),
      mockPath: getEnvOrDefault("MOCK_DATABASE_PATH", "./data/mock.db"),
    },
    dca: {
      amountUsdc: parseFloat(getEnvOrDefault("DCA_AMOUNT_USDC", "6")),
      intervalMs: getEnvInt("DCA_INTERVAL_MS", 86400000), // default: 24 hours
    },
    dcaWallet: {
      devPrivateKey: isDev ? devPrivateKey : undefined,
    },
    encryption: {
      masterKey: masterEncryptionKey,
    },
    price: {
      source: getEnvOrDefault("PRICE_SOURCE", "jupiter") as PriceSource,
      jupiterApiKey: process.env.JUPITER_API_KEY,
    },
    auth,
    health,
    web: webEnabled
      ? {
          enabled: true,
          port: getEnvInt("WEB_PORT", 3000),
        }
      : undefined,
    isDev,
  };
}
