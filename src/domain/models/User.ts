/**
 * User domain model
 */
export interface User {
  telegramId: number;
  walletAddress: string | null;
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
