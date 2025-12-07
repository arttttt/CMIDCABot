export interface TelegramConfig {
  botToken: string;
}

export interface SolanaConfig {
  rpcUrl: string;
  network: "devnet" | "mainnet-beta";
}

export interface DatabaseConfig {
  path: string;
}

export interface WebConfig {
  enabled: boolean;
  port: number;
}

export interface DcaConfig {
  amountSol: number;
  timeUtc: string; // "HH:MM" format
}

export interface Config {
  telegram: TelegramConfig;
  solana: SolanaConfig;
  database: DatabaseConfig;
  dca: DcaConfig;
  web?: WebConfig;
  isDev: boolean;
}
