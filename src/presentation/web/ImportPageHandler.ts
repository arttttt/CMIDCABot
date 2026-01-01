/**
 * ImportPageHandler - HTTP handler for secure wallet import via web form
 *
 * GET /import/:token  - Render import form
 * POST /import/:token - Process import submission
 *
 * Security:
 * - Token validated on both GET and POST
 * - Token consumed only on POST (one-time use)
 * - No sensitive data in URL or logs
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { TelegramId } from "../../types/id/index.js";
import type { ImportSessionRepository } from "../../domain/repositories/index.js";
import type { ImportWalletUseCase } from "../../domain/usecases/ImportWalletUseCase.js";
import type { MessageSender } from "../telegram/MessageSender.js";
import { logger } from "../../infrastructure/shared/logging/index.js";
import { HtmlUtils, BASE_STYLES } from "./html.js";

// Security headers for all pages
// Note: script-src 'unsafe-inline' required for client-side validation JS
const SECURITY_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  "Pragma": "no-cache",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'",
};

export class ImportPageHandler {
  constructor(
    private readonly sessionStore: ImportSessionRepository,
    private readonly importWallet: ImportWalletUseCase,
    private readonly messageSender: MessageSender,
  ) {}

  /**
   * Handle import page request
   * @returns true if request was handled, false otherwise
   */
  async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = req.url ?? "";

    // Only handle /import/:token
    if (!url.startsWith("/import/")) {
      return false;
    }

    const token = url.slice("/import/".length).split("?")[0];

    if (!token) {
      this.sendExpiredPage(res);
      return true;
    }

    if (req.method === "GET") {
      return this.handleGet(token, res);
    }

    if (req.method === "POST") {
      return this.handlePost(token, req, res);
    }

    // Method not allowed
    res.writeHead(405, SECURITY_HEADERS);
    res.end();
    return true;
  }

  private handleGet(token: string, res: ServerResponse): boolean {
    // Consume import token and create form session with CSRF token.
    // This prevents race condition: attacker can't POST with intercepted URL
    // because the import token is already consumed.
    const formSession = this.sessionStore.consumeToForm(token);

    if (!formSession) {
      this.sendExpiredPage(res);
      return true;
    }

    this.sendFormPage(res, formSession.csrfToken);
    return true;
  }

  private async handlePost(
    _token: string,
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<boolean> {
    // Parse POST body first to get CSRF token
    let body: string;
    try {
      body = await this.readBody(req);
    } catch {
      this.sendErrorPage(res, "Failed to read request body");
      return true;
    }

    // Parse form data and validate CSRF token
    const params = new URLSearchParams(body);
    const csrfToken = params.get("csrf");

    if (!csrfToken) {
      this.sendExpiredPage(res);
      return true;
    }

    // Consume form session and get telegramId
    const telegramId = this.sessionStore.consumeForm(csrfToken);

    if (telegramId === null) {
      this.sendExpiredPage(res);
      return true;
    }

    const secretInput = params.get("secret")?.trim();

    if (!secretInput) {
      this.sendErrorPage(res, "No key or seed phrase provided");
      await this.notifyUser(telegramId, false, "No key or seed phrase provided");
      return true;
    }

    // Execute import
    try {
      const result = await this.importWallet.execute(telegramId, secretInput);

      switch (result.type) {
        case "imported":
          logger.info("ImportPageHandler", "Wallet imported successfully", {
            telegramId,
            address: result.wallet!.address.slice(0, 8) + "...",
          });
          this.sendSuccessPage(res, result.wallet!.address);
          await this.notifyUser(telegramId, true, undefined, result.wallet!.address);
          break;

        case "already_exists":
          this.sendErrorPage(res, "Wallet already exists. Delete existing wallet first.");
          await this.notifyUser(telegramId, false, "Wallet already exists");
          break;

        case "invalid_key":
          this.sendErrorPage(res, result.error || "Invalid key or seed phrase");
          await this.notifyUser(telegramId, false, result.error || "Invalid key or seed phrase");
          break;

        case "dev_mode":
          this.sendErrorPage(res, "Cannot import wallets in dev mode");
          await this.notifyUser(telegramId, false, "Cannot import wallets in dev mode");
          break;

        default:
          this.sendErrorPage(res, "Import failed");
          await this.notifyUser(telegramId, false, "Import failed");
      }
    } catch (error) {
      logger.error("ImportPageHandler", "Import failed", {
        telegramId,
        error: error instanceof Error ? error.message : String(error),
      });
      this.sendErrorPage(res, "An unexpected error occurred");
      await this.notifyUser(telegramId, false, "An unexpected error occurred");
    }

    return true;
  }

  private readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const maxSize = 10 * 1024; // 10KB limit
      const timeoutMs = 30 * 1000; // 30 sec timeout (slow loris protection)
      let size = 0;

      const timeout = setTimeout(() => {
        req.destroy();
        reject(new Error("Request timeout"));
      }, timeoutMs);

      req.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxSize) {
          clearTimeout(timeout);
          req.destroy();
          reject(new Error("Request body too large"));
          return;
        }
        chunks.push(chunk);
      });

      req.on("end", () => {
        clearTimeout(timeout);
        resolve(Buffer.concat(chunks).toString("utf-8"));
      });

      req.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  private async notifyUser(
    tgId: TelegramId,
    success: boolean,
    error?: string,
    address?: string,
  ): Promise<void> {
    if (success && address) {
      const shortAddress = `${address.slice(0, 4)}...${address.slice(-4)}`;
      await this.messageSender.send(tgId, {
        text: `**Wallet Imported Successfully!**\n\nAddress: \`${shortAddress}\`\n\nUse /wallet to view details.`,
      });
    } else {
      await this.messageSender.send(tgId, {
        text: `**Import Failed**\n\n${error || "Unknown error"}\n\nUse /wallet import to try again.`,
      });
    }
  }

  private sendFormPage(res: ServerResponse, csrfToken: string): void {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Import Wallet</title>
  <style>
    ${BASE_STYLES}
    .form-box {
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 12px;
      padding: 20px;
    }
    textarea {
      width: 100%;
      min-height: 120px;
      background: #252525;
      border: 1px solid #444;
      border-radius: 8px;
      color: #e5e5e5;
      padding: 12px;
      font-family: 'SF Mono', Monaco, 'Consolas', monospace;
      font-size: 14px;
      resize: vertical;
      margin-bottom: 16px;
    }
    textarea:focus {
      outline: none;
      border-color: #666;
    }
    textarea::placeholder {
      color: #666;
    }
    button {
      width: 100%;
      padding: 14px;
      background: #3b82f6;
      border: none;
      border-radius: 8px;
      color: white;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover {
      background: #2563eb;
    }
    button:disabled {
      background: #1e40af;
      cursor: not-allowed;
    }
    .error {
      color: #ef4444;
      font-size: 14px;
      margin-bottom: 12px;
      display: none;
    }
    .error.show {
      display: block;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="icon">🔐</div>
      <h1>Import Wallet</h1>
    </div>
    <div class="form-box">
      <form method="POST" id="importForm">
        <input type="hidden" name="csrf" value="${csrfToken}">
        <textarea
          name="secret"
          id="secret"
          placeholder="Enter 12/24 word seed phrase or private key"
          autocomplete="off"
          spellcheck="false"
          required
        ></textarea>
        <div class="error" id="error"></div>
        <button type="submit" id="submitBtn">Import Wallet</button>
      </form>
    </div>
    <div class="warning">
      <div class="warning-title">Security Notice</div>
      <ul>
        <li>This link works only <strong>once</strong></li>
        <li>Data is sent directly to the bot server via HTTPS</li>
        <li>Never share your seed phrase with anyone</li>
      </ul>
    </div>
  </div>
  <script>
    const form = document.getElementById('importForm');
    const secret = document.getElementById('secret');
    const error = document.getElementById('error');
    const btn = document.getElementById('submitBtn');

    form.addEventListener('submit', (e) => {
      if (!secret.value.trim()) {
        e.preventDefault();
        error.textContent = 'Please enter a seed phrase or private key';
        error.classList.add('show');
        return;
      }
      error.classList.remove('show');
      btn.disabled = true;
      btn.textContent = 'Importing...';
    });
  </script>
</body>
</html>`;

    res.writeHead(200, SECURITY_HEADERS);
    res.end(html);
  }

  private sendSuccessPage(res: ServerResponse, address: string): void {
    const shortAddress = `${address.slice(0, 4)}...${address.slice(-4)}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Wallet Imported</title>
  <style>
    ${BASE_STYLES}
    .container { text-align: center; }
    .success-icon { font-size: 64px; margin-bottom: 16px; }
    .address {
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 16px;
      margin: 20px 0;
      font-family: 'SF Mono', Monaco, 'Consolas', monospace;
      font-size: 18px;
    }
    p { color: #888; line-height: 1.6; margin-top: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="success-icon">✅</div>
    <h1>Wallet Imported Successfully</h1>
    <div class="address">${HtmlUtils.escape(shortAddress)}</div>
    <p>You can close this page.<br>Check Telegram for details.</p>
  </div>
</body>
</html>`;

    res.writeHead(200, SECURITY_HEADERS);
    res.end(html);
  }

  private sendErrorPage(res: ServerResponse, errorMessage: string): void {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Import Failed</title>
  <style>
    ${BASE_STYLES}
    .container { text-align: center; }
    .error-icon { font-size: 64px; margin-bottom: 16px; }
    .error-message {
      background: #2a1a1a;
      border: 1px solid #5c2020;
      border-radius: 8px;
      padding: 16px;
      margin: 20px 0;
      color: #f87171;
    }
    p { color: #888; line-height: 1.6; margin-top: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="error-icon">❌</div>
    <h1>Import Failed</h1>
    <div class="error-message">${HtmlUtils.escape(errorMessage)}</div>
    <p>Please try again later.</p>
  </div>
</body>
</html>`;

    res.writeHead(400, SECURITY_HEADERS);
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
    <p>This link has already been used or has expired.<br>Use /wallet import in Telegram to get a new link.</p>
  </div>
</body>
</html>`;

    res.writeHead(410, SECURITY_HEADERS);
    res.end(html);
  }
}
