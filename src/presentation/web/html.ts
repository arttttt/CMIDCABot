/**
 * HTML utility functions and shared styles for web handlers
 */

/**
 * Base styles shared by all web pages
 */
export const BASE_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0a0a0a;
    color: #e5e5e5;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  .container { max-width: 480px; width: 100%; }
  .header { text-align: center; margin-bottom: 24px; }
  .icon { font-size: 48px; margin-bottom: 12px; }
  h1 { font-size: 24px; font-weight: 600; }
  .warning {
    background: #2a1f00;
    border: 1px solid #5c4100;
    border-radius: 12px;
    padding: 16px;
    margin-top: 20px;
  }
  .warning-title {
    color: #fbbf24;
    font-weight: 600;
    margin-bottom: 12px;
  }
  .warning ul {
    color: #d4d4d4;
    padding-left: 20px;
    line-height: 1.6;
  }
  .warning li { margin-bottom: 4px; }
  .secret-box {
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 24px;
  }
`;

export class HtmlUtils {
  /**
   * Escape HTML special characters to prevent XSS
   */
  static escape(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
}
