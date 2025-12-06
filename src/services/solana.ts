import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { SolanaConfig } from "../types/index.js";

export class SolanaService {
  private connection: Connection;
  private config: SolanaConfig;

  constructor(config: SolanaConfig) {
    this.config = config;
    this.connection = new Connection(config.rpcUrl, "confirmed");
  }

  async getBalance(address: string): Promise<number> {
    const publicKey = new PublicKey(address);
    const balance = await this.connection.getBalance(publicKey);
    return balance / LAMPORTS_PER_SOL;
  }

  async isValidAddress(address: string): Promise<boolean> {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  getConnection(): Connection {
    return this.connection;
  }

  getNetwork(): string {
    return this.config.network;
  }
}
