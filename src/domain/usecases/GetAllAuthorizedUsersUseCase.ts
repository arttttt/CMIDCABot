/**
 * GetAllAuthorizedUsersUseCase - retrieves all authorized users
 */

import { AuthRepository } from "../repositories/AuthRepository.js";
import { AuthorizedUser } from "../models/AuthorizedUser.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

export interface GetAllAuthorizedUsersResult {
  users: AuthorizedUser[];
  count: number;
}

export class GetAllAuthorizedUsersUseCase {
  constructor(private authRepository: AuthRepository) {}

  async execute(): Promise<GetAllAuthorizedUsersResult> {
    logger.debug("GetAllAuthorizedUsers", "Fetching all users");

    const users = await this.authRepository.getAll();
    const count = users.length;

    logger.debug("GetAllAuthorizedUsers", "Users fetched", { count });

    return { users, count };
  }
}
