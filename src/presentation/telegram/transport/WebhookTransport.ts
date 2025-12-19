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
    await this.registerWebhook();

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
    if (this.server) {
      await new Promise<void>((resolve, reject) => {
        this.server!.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      this.server = null;
    }
  }

  private async startServer(): Promise<void> {
    const webhookPath = this.getWebhookPath();

    this.server = createServer(async (req, res) => {
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
      url: string;
      drop_pending_updates: boolean;
      secret_token?: string;
    } = {
      url: this.config.url,
      drop_pending_updates: true,
    };

    if (this.config.secret) {
      options.secret_token = this.config.secret;
    }

    await this.bot.api.setWebhook(this.config.url, options);
    console.log("Webhook registered with Telegram");
  }

  private async handleWebhookRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // Validate secret token if configured
    if (this.config.secret) {
      const receivedToken = req.headers["x-telegram-bot-api-secret-token"];
      if (receivedToken !== this.config.secret) {
        res.writeHead(401);
        res.end("Unauthorized");
        return;
      }
    }

    // Read request body
    let body = "";
    try {
      body = await new Promise<string>((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
        req.on("error", reject);
      });
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

    // Process update through bot
    // Must respond quickly to Telegram (within 60 seconds)
    // so we acknowledge first then process
    res.writeHead(200);
    res.end();

    // Process the update asynchronously
    try {
      await this.bot.handleUpdate(update);
    } catch (error) {
      console.error("Failed to process webhook update:", error);
    }
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
