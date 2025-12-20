/**
 * Markdown escape utilities for Telegram messages
 *
 * Telegram uses a custom Markdown dialect (parse_mode: "Markdown").
 * Special characters must be escaped to prevent formatting issues.
 *
 * Special characters in Telegram Markdown:
 * - * for bold
 * - _ for italic
 * - ` for code
 * - [ ] for links
 *
 * @see https://core.telegram.org/bots/api#markdown-style
 */

/**
 * Characters that have special meaning in Telegram Markdown
 */
const MARKDOWN_SPECIAL_CHARS = /[_*`\[\]]/g;

/**
 * Markdown formatting utilities for Telegram
 *
 * Provides static methods for escaping and formatting text
 * for Telegram's Markdown parser.
 *
 * @example
 * import { Markdown } from "./markdown.js";
 *
 * // Escape dynamic content:
 * `Error: ${Markdown.escape(result.message)}`
 *
 * // Format as code:
 * Markdown.code(wallet.address)
 *
 * // Create link:
 * Markdown.link("View", "https://example.com")
 */
export class Markdown {
  /**
   * Escape special Markdown characters in text
   *
   * Use this method to escape dynamic content (user input, error messages,
   * API responses) that may contain special characters.
   *
   * @example
   * `Error: ${Markdown.escape(result.message)}`
   * `Username: ${Markdown.escape(username)}`
   */
  static escape(text: string): string {
    if (!text) return text;
    return text.replace(MARKDOWN_SPECIAL_CHARS, "\\$&");
  }

  /**
   * Create inline code block (backtick-wrapped)
   *
   * Content inside code blocks doesn't need escaping, but the content
   * itself shouldn't contain backticks.
   *
   * @example
   * Markdown.code(wallet.address)  // Returns: `address_here`
   */
  static code(text: string): string {
    if (!text) return text;
    // Remove any backticks from the content to prevent breaking the code block
    const sanitized = text.replace(/`/g, "'");
    return `\`${sanitized}\``;
  }

  /**
   * Create bold text
   *
   * @example
   * Markdown.bold("Important")  // Returns: *Important*
   */
  static bold(text: string): string {
    if (!text) return text;
    return `*${Markdown.escape(text)}*`;
  }

  /**
   * Create italic text
   *
   * @example
   * Markdown.italic("Note")  // Returns: _Note_
   */
  static italic(text: string): string {
    if (!text) return text;
    return `_${Markdown.escape(text)}_`;
  }

  /**
   * Create a Markdown link
   *
   * @example
   * Markdown.link("View", "https://example.com")  // Returns: [View](https://example.com)
   */
  static link(text: string, url: string): string {
    // Escape text but not URL (parentheses in URL are handled by Telegram)
    const escapedText = Markdown.escape(text);
    // Escape parentheses in URL to prevent breaking the link
    const escapedUrl = url.replace(/\)/g, "%29");
    return `[${escapedText}](${escapedUrl})`;
  }
}
