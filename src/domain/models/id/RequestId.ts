/**
 * Regex pattern for valid UUID (v4 format, case-insensitive)
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Request tracing UUID - standard UUID v4 format
 */
export class RequestId {
  constructor(readonly value: string) {
    if (!UUID_PATTERN.test(value)) {
      throw new Error(`Invalid RequestId: ${value}`);
    }
  }

  equals(other: RequestId): boolean {
    return this.value === other.value;
  }
}
