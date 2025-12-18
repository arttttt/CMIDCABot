/**
 * In-memory implementation of InviteToken repository for development/testing
 */
import { InviteTokenRepository } from "../../../domain/repositories/InviteTokenRepository.js";
import { InviteToken } from "../../../domain/models/InviteToken.js";
import { UserRole } from "../../../domain/models/AuthorizedUser.js";

export class InMemoryInviteTokenRepository implements InviteTokenRepository {
  private tokens = new Map<string, InviteToken>();

  async create(token: string, role: UserRole, createdBy: number, expiresAt: Date): Promise<void> {
    const now = new Date();
    this.tokens.set(token, {
      token,
      role,
      createdBy,
      createdAt: now,
      expiresAt,
      usedBy: null,
      usedAt: null,
    });
  }

  async getByToken(token: string): Promise<InviteToken | undefined> {
    return this.tokens.get(token);
  }

  async markUsed(token: string, usedBy: number): Promise<boolean> {
    const existing = this.tokens.get(token);
    if (!existing || existing.usedBy !== null) {
      return false;
    }

    this.tokens.set(token, {
      ...existing,
      usedBy,
      usedAt: new Date(),
    });
    return true;
  }

  async deleteExpired(): Promise<number> {
    const now = new Date();
    let deleted = 0;

    for (const [key, token] of this.tokens) {
      if (token.expiresAt < now && token.usedBy === null) {
        this.tokens.delete(key);
        deleted++;
      }
    }

    return deleted;
  }

  async getByCreator(createdBy: number): Promise<InviteToken[]> {
    return Array.from(this.tokens.values())
      .filter((token) => token.createdBy === createdBy)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}
