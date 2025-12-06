import {
  createSolanaRpc,
  address,
  lamports,
  type Rpc,
  type SolanaRpcApi,
  type Address,
} from "@solana/web3.js";
import { SolanaConfig } from "../types/index.js";

const LAMPORTS_PER_SOL = 1_000_000_000n;

export class SolanaService {
  private rpc: Rpc<SolanaRpcApi>;
  private config: SolanaConfig;

  constructor(config: SolanaConfig) {
    this.config = config;
    this.rpc = createSolanaRpc(config.rpcUrl);
  }

  async getBalance(walletAddress: string): Promise<number> {
    const addr = address(walletAddress);
    const { value } = await this.rpc.getBalance(addr).send();
    return Number(value) / Number(LAMPORTS_PER_SOL);
  }

  isValidAddress(walletAddress: string): boolean {
    try {
      address(walletAddress);
      return true;
    } catch {
      return false;
    }
  }

  getRpc(): Rpc<SolanaRpcApi> {
    return this.rpc;
  }

  getNetwork(): string {
    return this.config.network;
  }
}
