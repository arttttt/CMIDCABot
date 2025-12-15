/**
 * In-memory implementation of User repository
 *
 * Private keys are encrypted before storage and decrypted on retrieval.
 * This maintains consistency with SQLite implementation.
 */
import { UserRepository } from "../../../domain/repositories/UserRepository.js";
import { User, UserWithWallet, UserWithDcaWallet, ActiveDcaUser } from "../../../domain/models/User.js";
import { KeyEncryptionService } from "../../../services/encryption.js";

export class InMemoryUserRepository implements UserRepository {
  private users = new Map<number, User>();

  constructor(private encryptionService: KeyEncryptionService) {}

  /**
   * Decrypt a private key from storage.
   * Returns null if key is null/empty.
   */
  private async decryptPrivateKey(encryptedKey: string | null): Promise<string | null> {
    if (!encryptedKey) return null;
    return this.encryptionService.decrypt(encryptedKey);
  }

  /**
   * Encrypt a private key for storage.
   */
  private async encryptPrivateKey(plainKey: string): Promise<string> {
    return this.encryptionService.encrypt(plainKey);
  }

  async getById(telegramId: number): Promise<User | undefined> {
    const user = this.users.get(telegramId);
    if (!user) return undefined;

    // Return a copy with decrypted private key
    return {
      ...user,
      privateKey: await this.decryptPrivateKey(user.privateKey),
    };
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

  async getAllWithDcaWallet(): Promise<UserWithDcaWallet[]> {
    const result: UserWithDcaWallet[] = [];
    for (const user of this.users.values()) {
      if (user.privateKey) {
        // Decrypt private key for use
        const decryptedKey = await this.decryptPrivateKey(user.privateKey);
        if (decryptedKey) {
          result.push({
            telegramId: user.telegramId,
            privateKey: decryptedKey,
          });
        }
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
}
