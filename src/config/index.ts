import { Config } from "../types/config.js";

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

export function loadConfig(): Config {
  const nodeEnv = getEnvOrDefault("NODE_ENV", "development");
  const isDev = nodeEnv !== "production";

  return {
    telegram: {
      botToken: getEnvOrThrow("TELEGRAM_BOT_TOKEN"),
    },
    solana: {
      rpcUrl: getEnvOrDefault("SOLANA_RPC_URL", "https://api.devnet.solana.com"),
      network: getEnvOrDefault("SOLANA_NETWORK", "devnet") as "devnet" | "mainnet-beta",
    },
    database: {
      path: getEnvOrDefault("DATABASE_PATH", "./data/bot.db"),
    },
    isDev,
  };
}
