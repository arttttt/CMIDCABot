/**
 * Init user use case
 */

import type { TelegramId } from "../models/id/index.js";
import { UserRepository } from "../repositories/UserRepository.js";
import { InitUserResult } from "./types.js";

export class InitUserUseCase {
  constructor(private userRepository: UserRepository) {}

  async execute(telegramId: TelegramId): Promise<InitUserResult> {
    await this.userRepository.create(telegramId);
    return { type: "success" };
  }
}
