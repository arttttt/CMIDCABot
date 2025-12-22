/**
 * SecretPageHandler - HTTP handler for one-time secret display
 *
 * Handles both seed phrases and private keys via unified /secret/:token endpoint.
 *
 * Security headers:
 * - Cache-Control: no-store (prevent browser caching)
 * - X-Robots-Tag: noindex (prevent search indexing)
 * - CSP: minimal policy
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { SecretStore } from "../../services/SecretStore.js";
import { logger } from "../../services/logger.js";
import { HtmlUtils, BASE_STYLES } from "./html.js";

// Security headers for secret pages
const SECURITY_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  "Pragma": "no-cache",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
};

export class SecretPageHandler {
  constructor(private readonly secretStore: SecretStore) {}

  /**
   * Handle secret page request
   * @returns true if request was handled, false otherwise
   */
  async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = req.url ?? "";

    // Only handle GET /secret/:token
    if (req.method !== "GET" || !url.startsWith("/secret/")) {
      return false;
    }

    const token = url.slice("/secret/".length).split("?")[0];

    if (!token) {
      this.sendExpiredPage(res);
      return true;
    }

    try {
      const secret = await this.secretStore.consume(token);

      if (!secret) {
        this.sendExpiredPage(res);
      } else {
        this.sendSecretPage(res, secret);
      }
    } catch (error) {
      logger.error("SecretPageHandler", "Error consuming secret", {
        error: error instanceof Error ? error.message : String(error),
      });
      this.sendErrorPage(res);
    }

    return true;
  }

  private sendSecretPage(res: ServerResponse, secret: string): void {
    // Detect if it's a seed phrase (12 or 24 words) or private key
    const words = secret.split(" ");
    const isSeedPhrase = words.length === 12 || words.length === 24;

    if (isSeedPhrase) {
      this.sendSeedPhrasePage(res, words);
    } else {
      this.sendPrivateKeyPage(res, secret);
    }
  }

  private sendSeedPhrasePage(res: ServerResponse, words: string[]): void {
    const wordRows = words
      .map((word, i) => `<span class="word"><span class="num">${i + 1}.</span> ${HtmlUtils.escape(word)}</span>`)
      .join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Recovery Phrase</title>
  <style>
    ${BASE_STYLES}
    .secret-box {
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
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      background: #252525;
      padding: 12px 8px;
      border-radius: 8px;
      font-family: 'SF Mono', Monaco, 'Consolas', monospace;
      font-size: 14px;
      min-height: 44px;
    }
    .num {
      color: #666;
      min-width: 24px;
      text-align: right;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="icon">🔐</div>
      <h1>Recovery Phrase</h1>
    </div>
    <div class="secret-box">
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

  private sendPrivateKeyPage(res: ServerResponse, privateKey: string): void {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Private Key</title>
  <style>
    ${BASE_STYLES}
    .secret-box {
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .key {
      font-family: 'SF Mono', Monaco, 'Consolas', monospace;
      font-size: 12px;
      word-break: break-all;
      background: #252525;
      padding: 16px;
      border-radius: 8px;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="icon">🔑</div>
      <h1>Private Key</h1>
    </div>
    <div class="secret-box">
      <div class="key">${HtmlUtils.escape(privateKey)}</div>
    </div>
    <div class="warning">
      <div class="warning-title">⚠️ Security Warning</div>
      <ul>
        <li>This page is shown <strong>only once</strong></li>
        <li>Anyone with this key can access your funds</li>
        <li>Store securely offline</li>
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
    ${BASE_STYLES}
    .container { text-align: center; }
    .icon { font-size: 64px; }
    p { color: #888; line-height: 1.6; margin-top: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">⏰</div>
    <h1>Link Expired</h1>
    <p>This link has already been used or has expired.</p>
  </div>
</body>
</html>`;

    res.writeHead(410, SECURITY_HEADERS);
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
    ${BASE_STYLES}
    .container { text-align: center; }
    .icon { font-size: 64px; }
    p { color: #888; margin-top: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">❌</div>
    <h1>Something went wrong</h1>
    <p>Please try again later.</p>
  </div>
</body>
</html>`;

    res.writeHead(500, SECURITY_HEADERS);
    res.end(html);
  }
}
