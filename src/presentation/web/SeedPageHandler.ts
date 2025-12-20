/**
 * SeedPageHandler - HTTP handler for one-time seed phrase display
 *
 * Security headers:
 * - Cache-Control: no-store (prevent browser caching)
 * - X-Robots-Tag: noindex (prevent search indexing)
 * - CSP: minimal policy
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { SecretStore } from "../../services/SecretStore.js";
import { logger } from "../../services/logger.js";

// Security headers for seed page
const SECURITY_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  "Pragma": "no-cache",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
};

export class SeedPageHandler {
  constructor(private readonly secretStore: SecretStore) {}

  /**
   * Handle seed page request
   * @returns true if request was handled, false otherwise
   */
  async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = req.url ?? "";

    // Only handle GET /seed/:token
    if (req.method !== "GET" || !url.startsWith("/seed/")) {
      return false;
    }

    const token = url.slice("/seed/".length).split("?")[0]; // Remove query params

    if (!token) {
      this.sendExpiredPage(res);
      return true;
    }

    try {
      const seed = await this.secretStore.consume(token);

      if (!seed) {
        this.sendExpiredPage(res);
      } else {
        this.sendSeedPage(res, seed);
      }
    } catch (error) {
      logger.error("SeedPageHandler", "Error consuming secret", {
        error: error instanceof Error ? error.message : String(error),
      });
      this.sendErrorPage(res);
    }

    return true;
  }

  private sendSeedPage(res: ServerResponse, seed: string): void {
    // Split seed into word pairs for display
    const words = seed.split(" ");
    const wordRows = words
      .map((word, i) => `<span class="word"><span class="num">${i + 1}.</span> ${this.escapeHtml(word)}</span>`)
      .join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Recovery Phrase</title>
  <style>
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
    .container {
      max-width: 480px;
      width: 100%;
    }
    .header {
      text-align: center;
      margin-bottom: 24px;
    }
    .icon { font-size: 48px; margin-bottom: 12px; }
    h1 { font-size: 24px; font-weight: 600; }
    .seed-box {
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .words {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    .word {
      background: #252525;
      padding: 10px 8px;
      border-radius: 8px;
      font-family: 'SF Mono', Monaco, 'Consolas', monospace;
      font-size: 14px;
      text-align: center;
    }
    .num {
      color: #666;
      margin-right: 4px;
    }
    .warning {
      background: #2a1f00;
      border: 1px solid #5c4100;
      border-radius: 12px;
      padding: 16px;
    }
    .warning-title {
      color: #fbbf24;
      font-weight: 600;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .warning ul {
      color: #d4d4d4;
      padding-left: 20px;
      line-height: 1.6;
    }
    .warning li { margin-bottom: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="icon">🔐</div>
      <h1>Your Recovery Phrase</h1>
    </div>
    <div class="seed-box">
      <div class="words">${wordRows}</div>
    </div>
    <div class="warning">
      <div class="warning-title">⚠️ Important</div>
      <ul>
        <li>This page is shown <strong>only once</strong></li>
        <li>Write down these words and store offline</li>
        <li>Never share with anyone</li>
        <li>Close this page after saving</li>
      </ul>
    </div>
  </div>
</body>
</html>`;

    res.writeHead(200, SECURITY_HEADERS);
    res.end(html);
  }

  private sendExpiredPage(res: ServerResponse): void {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Link Expired</title>
  <style>
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
      text-align: center;
    }
    .container { max-width: 400px; }
    .icon { font-size: 64px; margin-bottom: 16px; }
    h1 { font-size: 24px; margin-bottom: 12px; }
    p { color: #888; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">⏰</div>
    <h1>Link Expired</h1>
    <p>This link has already been used or has expired.<br>
    Create a new wallet to get a new recovery phrase.</p>
  </div>
</body>
</html>`;

    res.writeHead(410, SECURITY_HEADERS); // 410 Gone
    res.end(html);
  }

  private sendErrorPage(res: ServerResponse): void {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Error</title>
  <style>
    body {
      font-family: -apple-system, sans-serif;
      background: #0a0a0a;
      color: #e5e5e5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
    }
  </style>
</head>
<body>
  <div>
    <div style="font-size: 64px">❌</div>
    <h1>Something went wrong</h1>
    <p>Please try again later.</p>
  </div>
</body>
</html>`;

    res.writeHead(500, SECURITY_HEADERS);
    res.end(html);
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
}
