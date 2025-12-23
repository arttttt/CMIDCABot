/**
 * In-memory implementation of User repository
 *
 * Private keys are encrypted at rest using AES-256-GCM.
 * Keys are stored encrypted and returned encrypted - decryption happens
 * only at the moment of signing (in SolanaService) to minimize exposure.
 */
import { UserRepository } from "../../../domain/repositories/UserRepository.js";
import { User, UserWithWallet, UserWithDcaWallet, ActiveDcaUser } from "../../../domain/models/User.js";
import { KeyEncryptionService } from "../../../infrastructure/internal/crypto/index.js";

export class InMemoryUserRepository implements UserRepository {
  private users = new Map<number, User>();

  constructor(private encryptionService: KeyEncryptionService) {}

  /**
   * Encrypt a private key for storage.
   */
  private async encryptPrivateKey(plainKey: string): Promise<string> {
    return this.encryptionService.encrypt(plainKey);
  }

  /**
   * Get user by Telegram ID.
   * Note: privateKey is returned ENCRYPTED for security.
   */
  async getById(telegramId: number): Promise<User | undefined> {
    const user = this.users.get(telegramId);
    if (!user) return undefined;

    // Return a copy (privateKey remains encrypted)
    return { ...user };
  }

  async create(telegramId: number): Promise<void> {
    if (this.users.has(telegramId)) {
      return;
    }

    const now = new Date();
    this.users.set(telegramId, {
      telegramId,
      walletAddress: null,
      privateKey: null,
      isDcaActive: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  async setWalletAddress(telegramId: number, walletAddress: string): Promise<void> {
    const user = this.users.get(telegramId);
    if (user) {
      user.walletAddress = walletAddress;
      user.updatedAt = new Date();
    }
  }

  async getAllWithWallet(): Promise<UserWithWallet[]> {
    const result: UserWithWallet[] = [];
    for (const user of this.users.values()) {
      if (user.walletAddress) {
        result.push({
          telegramId: user.telegramId,
          walletAddress: user.walletAddress,
        });
      }
    }
    return result;
  }

  async setPrivateKey(telegramId: number, privateKey: string): Promise<void> {
    const user = this.users.get(telegramId);
    if (user) {
      // Encrypt private key before storage
      user.privateKey = await this.encryptPrivateKey(privateKey);
      user.updatedAt = new Date();
    }
  }

  async clearPrivateKey(telegramId: number): Promise<void> {
    const user = this.users.get(telegramId);
    if (user) {
      user.privateKey = null;
      user.updatedAt = new Date();
    }
  }

  /**
   * Get all users with DCA wallets.
   * Note: privateKey is returned ENCRYPTED for security.
   */
  async getAllWithDcaWallet(): Promise<UserWithDcaWallet[]> {
    const result: UserWithDcaWallet[] = [];
    for (const user of this.users.values()) {
      if (user.privateKey) {
        result.push({
          telegramId: user.telegramId,
          privateKey: user.privateKey, // Encrypted
        });
      }
    }
    return result;
  }

  async setDcaActive(telegramId: number, active: boolean): Promise<void> {
    const user = this.users.get(telegramId);
    if (user) {
      user.isDcaActive = active;
      user.updatedAt = new Date();
    }
  }

  async getAllActiveDcaUsers(): Promise<ActiveDcaUser[]> {
    const result: ActiveDcaUser[] = [];
    for (const user of this.users.values()) {
      if (user.walletAddress && user.isDcaActive) {
        result.push({
          telegramId: user.telegramId,
          walletAddress: user.walletAddress,
        });
      }
    }
    return result;
  }

  async hasActiveDcaUsers(): Promise<boolean> {
    for (const user of this.users.values()) {
      if (user.walletAddress && user.isDcaActive) {
        return true;
      }
    }
    return false;
  }

  async delete(telegramId: number): Promise<void> {
    this.users.delete(telegramId);
  }
}
