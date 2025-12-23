/**
 * ImportSessionRepository - interface for secure wallet import sessions
 *
 * Stores telegramId with one-time token for secure wallet import via web form.
 *
 * Features:
 * - TTL with automatic expiration
 * - One-time consumption (get + delete atomically)
 * - CSRF protection via form sessions
 */

export interface FormSession {
  csrfToken: string;
  telegramId: number;
}

export interface ImportSessionRepository {
  /**
   * Create an import session and return the one-time URL
   *
   * @param telegramId - User ID for the import operation
   * @returns URL to access the import form
   */
  store(telegramId: number): string;

  /**
   * Get TTL in minutes (for user display)
   */
  getTtlMinutes(): number;

  /**
   * Consume import token and create a form session with CSRF token.
   * Used on GET to prevent race condition between GET and POST.
   *
   * @param token - The import session token
   * @returns Object with csrfToken and telegramId, or null if invalid/expired
   */
  consumeToForm(token: string): FormSession | null;

  /**
   * Consume form session by CSRF token.
   * Used on POST to validate the form submission.
   *
   * @param csrfToken - The CSRF token from the form
   * @returns telegramId or null if invalid/expired
   */
  consumeForm(csrfToken: string): number | null;
}
