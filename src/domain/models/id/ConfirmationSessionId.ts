/**
 * Confirmation session identifier - cryptographically secure base64url string
 *
 * Format: 22 characters, base64url encoded (16 bytes = 128 bits entropy)
 * Example: "X7kL2mNpQ3rS5tU8vW9y_A"
 */
export class ConfirmationSessionId {
  private static readonly FORMAT_REGEX = /^[A-Za-z0-9_-]{22}$/;

  constructor(readonly value: string) {
    if (!ConfirmationSessionId.FORMAT_REGEX.test(value)) {
      throw new Error(`Invalid ConfirmationSessionId: ${value}`);
    }
  }

  equals(other: ConfirmationSessionId): boolean {
    return this.value === other.value;
  }

  /**
   * Get truncated ID for logging (first 4 chars + "...")
   */
  toLogString(): string {
    return this.value.substring(0, 4) + "...";
  }
}
