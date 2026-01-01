/**
 * Error thrown when a user is not found in the repository.
 */
export class UserNotFoundError extends Error {
  constructor(telegramId: string | number) {
    super(`User not found: ${telegramId}`);
    this.name = "UserNotFoundError";
  }
}
