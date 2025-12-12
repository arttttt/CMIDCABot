/**
 * Init user use case
 */

import { UserRepository } from "../repositories/UserRepository.js";
import { DcaService } from "../../services/dca.js";
import { InitUserResult } from "./types.js";

export class InitUserUseCase {
  constructor(
    private userRepository: UserRepository,
    private dca: DcaService | undefined,
  ) {}

  async execute(telegramId: number): Promise<InitUserResult> {
    await this.userRepository.create(telegramId);
    await this.dca?.createPortfolio(telegramId);
    return { type: "success" };
  }
}
