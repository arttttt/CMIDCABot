/**
 * Telegram user ID - positive integer assigned by Telegram
 */
export class TelegramId {
  constructor(readonly value: number) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`Invalid TelegramId: ${value}`);
    }
  }

  equals(other: TelegramId): boolean {
    return this.value === other.value;
  }
}
