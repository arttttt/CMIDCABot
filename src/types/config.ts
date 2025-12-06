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

export interface Config {
  telegram: TelegramConfig;
  solana: SolanaConfig;
  database: DatabaseConfig;
  isDev: boolean;
}
