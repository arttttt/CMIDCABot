/**
 * In-memory implementation of Auth repository for development/testing
 */
import { AuthRepository } from "../../../domain/repositories/AuthRepository.js";
import { AuthorizedUser, UserRole } from "../../../domain/models/AuthorizedUser.js";

export class InMemoryAuthRepository implements AuthRepository {
  private users = new Map<number, AuthorizedUser>();

  async getById(telegramId: number): Promise<AuthorizedUser | undefined> {
    return this.users.get(telegramId);
  }

  async getAll(): Promise<AuthorizedUser[]> {
    return Array.from(this.users.values()).sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );
  }

  async getByRole(role: UserRole): Promise<AuthorizedUser[]> {
    return Array.from(this.users.values())
      .filter((user) => user.role === role)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async add(telegramId: number, role: UserRole, addedBy: number | null): Promise<void> {
    if (this.users.has(telegramId)) {
      return; // Already exists
    }

    const now = new Date();
    this.users.set(telegramId, {
      telegramId,
      role,
      addedBy,
      createdAt: now,
      updatedAt: now,
    });
  }

  async remove(telegramId: number): Promise<boolean> {
    return this.users.delete(telegramId);
  }

  async updateRole(telegramId: number, newRole: UserRole): Promise<boolean> {
    const user = this.users.get(telegramId);
    if (!user) return false;

    this.users.set(telegramId, {
      ...user,
      role: newRole,
      updatedAt: new Date(),
    });
    return true;
  }

  async isAuthorized(telegramId: number): Promise<boolean> {
    return this.users.has(telegramId);
  }

  async count(): Promise<number> {
    return this.users.size;
  }
}
