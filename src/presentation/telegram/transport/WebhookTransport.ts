/**
 * Webhook transport implementation
 * Receives updates via HTTP endpoint instead of long polling
 * Enables seamless redeploys without 409 conflicts
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import type { Bot, Context } from "grammy";
import type { Update } from "@grammyjs/types";
import type { BotTransport, TransportDeps, WebhookConfig } from "./types.js";

export class WebhookTransport implements BotTransport {
  private readonly bot: Bot<Context>;
  private readonly config: WebhookConfig;
  private readonly isDev: boolean;
  private readonly onStart?: (botInfo: { username: string }) => void;
  private server: Server | null = null;

  constructor(deps: TransportDeps, config: WebhookConfig) {
    this.bot = deps.bot;
    this.isDev = deps.isDev;
    this.onStart = deps.onStart;
    this.config = config;
  }

  async start(): Promise<void> {
    // Initialize bot (required for processing updates)
    await this.bot.init();

    // Get bot info for logging
    const botInfo = this.bot.botInfo;

    // Start HTTP server for webhook
    await this.startServer();

    // Register webhook with Telegram
    // If this fails, we need to clean up the server
    try {
      await this.registerWebhook();
    } catch (error) {
      // Stop the server since webhook registration failed
      await this.stopServer();
      throw error;
    }

    // Notify startup
    this.onStart?.({ username: botInfo.username });

    if (!this.isDev) {
      console.log(`Bot @${botInfo.username} is running (webhook mode)`);
      console.log(`Webhook URL: ${this.config.url}`);
    }
  }

  async stop(): Promise<void> {
    // Remove webhook from Telegram
    try {
      await this.bot.api.deleteWebhook();
      console.log("Webhook removed");
    } catch (error) {
      console.error("Failed to remove webhook:", error);
    }

    // Stop HTTP server
    await this.stopServer();
  }

  private async stopServer(): Promise<void> {
    if (!this.server) {
      return;
    }

    const server = this.server;
    this.server = null;

    await new Promise<void>((resolve, reject) => {
      // Set a timeout for graceful shutdown (5 seconds)
      const timeout = setTimeout(() => {
        console.warn("Server close timeout, forcing shutdown");
        resolve();
      }, 5000);

      server.close((err) => {
        clearTimeout(timeout);
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async startServer(): Promise<void> {
    const webhookPath = this.getWebhookPath();

    this.server = createServer((req, res) => {
      // Wrap in async IIFE with error handling
      (async () => {
        // Handle webhook endpoint
        if (req.method === "POST" && req.url === webhookPath) {
          await this.handleWebhookRequest(req, res);
          return;
        }

        // Handle health check (keep health endpoint working)
        if (req.url === "/health" || req.url === "/") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "ok" }));
          return;
        }

        // 404 for unknown routes
        res.writeHead(404);
        res.end();
      })().catch((error) => {
        console.error("[Webhook] Unhandled error in request handler:", error);
        if (!res.headersSent) {
          res.writeHead(500);
          res.end("Internal Server Error");
        }
      });
    });

    // Handle server errors
    this.server.on("error", (error) => {
      console.error("[Webhook] Server error:", error);
    });

    this.server.on("close", () => {
      console.log("[Webhook] Server closed");
    });

    await new Promise<void>((resolve) => {
      this.server!.listen(this.config.port, this.config.host, () => {
        console.log(`Webhook server listening on port ${this.config.port}`);
        resolve();
      });
    });
  }

  private async registerWebhook(): Promise<void> {
    const options: {
      drop_pending_updates: boolean;
      secret_token?: string;
    } = {
      drop_pending_updates: true,
    };

    if (this.config.secret) {
      options.secret_token = this.config.secret;
    }

    console.log(`Registering webhook: ${this.config.url}`);
    const result = await this.bot.api.setWebhook(this.config.url, options);
    console.log(`setWebhook result: ${result}`);

    // Verify webhook was actually set
    const info = await this.bot.api.getWebhookInfo();
    if (info.url !== this.config.url) {
      throw new Error(
        `Webhook registration failed. Expected URL: ${this.config.url}, got: ${info.url || "(empty)"}`
      );
    }

    console.log("Webhook registered with Telegram");
  }

  private async handleWebhookRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    console.log(`[Webhook] Incoming request from ${req.socket.remoteAddress}`);

    // Validate secret token if configured
    if (this.config.secret) {
      const receivedToken = req.headers["x-telegram-bot-api-secret-token"];
      if (receivedToken !== this.config.secret) {
        console.log("[Webhook] Unauthorized: invalid secret token");
        res.writeHead(401);
        res.end("Unauthorized");
        return;
      }
    }

    // Read request body with timeout
    let body = "";
    try {
      body = await this.readRequestBody(req);
    } catch (error) {
      console.error("Failed to read webhook request body:", error);
      res.writeHead(400);
      res.end("Bad Request");
      return;
    }

    // Parse update
    let update: Update;
    try {
      update = JSON.parse(body) as Update;
    } catch (error) {
      console.error("Failed to parse webhook update:", error);
      res.writeHead(400);
      res.end("Bad Request");
      return;
    }

    console.log(`[Webhook] Update ${update.update_id} received`);

    // Process update through bot
    // Must respond quickly to Telegram (within 60 seconds)
    // so we acknowledge first then process
    res.writeHead(200);
    res.end();

    // Process the update asynchronously
    try {
      console.log(`[Webhook] Processing update ${update.update_id}...`);
      await this.bot.handleUpdate(update);
      console.log(`[Webhook] Update ${update.update_id} processed`);
    } catch (error) {
      console.error(`[Webhook] Failed to process update ${update.update_id}:`, error);
    }
  }

  private readRequestBody(req: IncomingMessage): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];

      // Timeout for reading body (10 seconds)
      const timeout = setTimeout(() => {
        req.destroy();
        reject(new Error("Request body read timeout"));
      }, 10000);

      req.on("data", (chunk: Buffer) => chunks.push(chunk));

      req.on("end", () => {
        clearTimeout(timeout);
        resolve(Buffer.concat(chunks).toString("utf-8"));
      });

      req.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private getWebhookPath(): string {
    try {
      const url = new URL(this.config.url);
      return url.pathname || "/webhook";
    } catch {
      return "/webhook";
    }
  }
}
