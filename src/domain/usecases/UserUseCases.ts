/**
 * User use cases - domain operations for user management
 */

import { UserRepository } from "../repositories/UserRepository.js";
import { DcaService } from "../../services/dca.js";
import { InitUserResult } from "./types.js";

export class UserUseCases {
  constructor(
    private userRepository: UserRepository,
    private dca: DcaService | undefined,
  ) {}

  /**
   * Initialize user (create user and portfolio if in dev mode)
   */
  async initUser(telegramId: number): Promise<InitUserResult> {
    await this.userRepository.create(telegramId);
    await this.dca?.createPortfolio(telegramId);
    return { type: "success" };
  }
}
