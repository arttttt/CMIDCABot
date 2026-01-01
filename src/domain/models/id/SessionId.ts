/**
 * HTTP session identifier - non-empty string
 */
export class SessionId {
  constructor(readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error("Invalid session ID: must be non-empty");
    }
  }
}
