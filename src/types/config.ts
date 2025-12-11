export interface TelegramConfig {
  botToken: string;
}

export interface SolanaConfig {
  rpcUrl: string;
  network: "devnet" | "mainnet-beta";
}

export type DatabaseMode = "sqlite" | "memory";

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

export interface Config {
  telegram: TelegramConfig;
  solana: SolanaConfig;
  database: DatabaseConfig;
  dca: DcaConfig;
  web?: WebConfig;
  isDev: boolean;
}
