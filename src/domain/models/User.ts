/**
 * User domain model
 */
export interface User {
  telegramId: number;
  walletAddress: string | null;
  privateKey: string | null;
  isDcaActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User with required wallet address (for operations that need it)
 */
export interface UserWithWallet {
  telegramId: number;
  walletAddress: string;
}

/**
 * User with DCA wallet (private key available)
 */
export interface UserWithDcaWallet {
  telegramId: number;
  privateKey: string;
}

/**
 * Active DCA user - has wallet AND DCA is enabled
 */
export interface ActiveDcaUser {
  telegramId: number;
  walletAddress: string;
}
