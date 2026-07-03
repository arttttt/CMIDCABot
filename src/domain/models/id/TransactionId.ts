/**
 * Transaction identifier - positive integer database id
 */
export class TransactionId {
  constructor(readonly value: number) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`Invalid TransactionId: ${value}`);
    }
  }

  equals(other: TransactionId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return String(this.value);
  }
}
