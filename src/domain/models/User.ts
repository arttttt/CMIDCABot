/**
 * User domain model
 */
import type { TelegramId, WalletAddress } from "./id/index.js";

export interface User {
  telegramId: TelegramId;
  walletAddress: WalletAddress | null;
  privateKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User with required wallet address (for operations that need it)
 */
export interface UserWithWallet {
  telegramId: TelegramId;
  walletAddress: WalletAddress;
}
