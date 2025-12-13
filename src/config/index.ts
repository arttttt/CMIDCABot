import { Config, DatabaseMode, PriceSource } from "../types/config.js";

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

  // DEV_WALLET_PRIVATE_KEY is optional, only used in dev mode
  const devPrivateKey = process.env.DEV_WALLET_PRIVATE_KEY || undefined;

  return {
    telegram: {
      // Bot token is optional when running in web-only mode
      botToken: webEnabled
        ? getEnvOrDefault("TELEGRAM_BOT_TOKEN", "")
        : getEnvOrThrow("TELEGRAM_BOT_TOKEN"),
    },
    solana: {
      rpcUrl: getEnvOrDefault("SOLANA_RPC_URL", "https://api.devnet.solana.com"),
      network: getEnvOrDefault("SOLANA_NETWORK", "devnet") as "devnet" | "mainnet-beta",
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
    price: {
      source: getEnvOrDefault("PRICE_SOURCE", "jupiter") as PriceSource,
    },
    web: webEnabled
      ? {
          enabled: true,
          port: getEnvInt("WEB_PORT", 3000),
        }
      : undefined,
    isDev,
  };
}
