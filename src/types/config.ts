export interface TelegramConfig {
  botToken: string;
}

export interface SolanaConfig {
  rpcUrl: string;
}

export type DatabaseMode = "sqlite" | "memory";

export type PriceSource = "jupiter" | "mock";

export interface DatabaseConfig {
  mode: DatabaseMode;
  path: string;
  mockPath: string;
}

export interface WebConfig {
  enabled: boolean;
  port: number;
}

export interface DcaConfig {
  amountUsdc: number;
  intervalMs: number; // interval between purchases in milliseconds
}

export interface DcaWalletConfig {
  /** Dev override: use this private key (base64) for all users instead of generating */
  devPrivateKey?: string;
}

export interface EncryptionConfig {
  /** Master key for encrypting private keys (base64-encoded 32 bytes) */
  masterKey: string;
}

export interface AuthConfig {
  /** Owner Telegram ID - super admin who cannot be removed */
  ownerTelegramId: number;
  /** Path to authorization database */
  dbPath: string;
}

export interface PriceConfig {
  source: PriceSource;
  jupiterApiKey?: string;
}

export interface Config {
  telegram: TelegramConfig;
  solana: SolanaConfig;
  database: DatabaseConfig;
  dca: DcaConfig;
  dcaWallet: DcaWalletConfig;
  encryption: EncryptionConfig;
  price: PriceConfig;
  auth: AuthConfig;
  web?: WebConfig;
  isDev: boolean;
}
