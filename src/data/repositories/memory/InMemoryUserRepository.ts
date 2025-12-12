/**
 * In-memory implementation of User repository
 */
import { UserRepository } from "../../../domain/repositories/UserRepository.js";
import { User, UserWithWallet, UserWithDcaWallet } from "../../../domain/models/User.js";

export class InMemoryUserRepository implements UserRepository {
  private users = new Map<number, User>();

  async getById(telegramId: number): Promise<User | undefined> {
    return this.users.get(telegramId);
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
      user.privateKey = privateKey;
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
        result.push({
          telegramId: user.telegramId,
          privateKey: user.privateKey,
        });
      }
    }
    return result;
  }
}
