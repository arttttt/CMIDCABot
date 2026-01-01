/**
 * HTTP session identifier - non-empty string
 *
 * Note: Currently a placeholder for future HTTP transport support.
 * Used in UserIdentity type but not yet instantiated in code.
 */
export class SessionId {
  constructor(readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error(`Invalid SessionId: value must be non-empty`);
    }
  }

  equals(other: SessionId): boolean {
    return this.value === other.value;
  }
}
