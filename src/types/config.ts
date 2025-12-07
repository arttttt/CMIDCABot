export interface TelegramConfig {
  botToken: string;
}

export interface SolanaConfig {
  rpcUrl: string;
  network: "devnet" | "mainnet-beta";
}

export interface DatabaseConfig {
  path: string;
  mockPath: string;
}

export interface WebConfig {
  enabled: boolean;
  port: number;
}

export interface DcaConfig {
  amountSol: number;
  cronSchedule: string; // cron expression (e.g., "0 0 * * *" for daily at 00:00 UTC)
  intervalMs: number; // interval in ms, derived from cron for catch-up calculations
}

export interface Config {
  telegram: TelegramConfig;
  solana: SolanaConfig;
  database: DatabaseConfig;
  dca: DcaConfig;
  web?: WebConfig;
  isDev: boolean;
}
