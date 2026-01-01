/**
 * User domain model
 */
import type { TelegramId, WalletAddress } from "./id/index.js";

export interface User {
  telegramId: TelegramId;
  walletAddress: WalletAddress | null;
  privateKey: string | null;
  isDcaActive: boolean;
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

/**
 * User with DCA wallet (private key available)
 */
export interface UserWithDcaWallet {
  telegramId: TelegramId;
  privateKey: string;
}

/**
 * Active DCA user - has wallet AND DCA is enabled
 */
export interface ActiveDcaUser {
  telegramId: TelegramId;
  walletAddress: WalletAddress;
}
