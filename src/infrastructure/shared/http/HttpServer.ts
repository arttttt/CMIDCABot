/**
 * HTTP Server for the bot
 *
 * Handles:
 * - Health checks for container orchestration (/health)
 * - One-time secret pages (/secret/:token)
 * - Extensible via pluggable handlers
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";

export interface HttpServerConfig {
  port: number;
  host: string;
}

export interface HttpHandler {
  handle(req: IncomingMessage, res: ServerResponse): Promise<boolean>;
}

export class HttpServer {
  private server: Server | null = null;
  private readonly config: HttpServerConfig;
  private handlers: HttpHandler[] = [];

  constructor(config: HttpServerConfig) {
    this.config = config;
  }

  /**
   * Register an HTTP handler
   * Handlers are called in order until one returns true
   */
  addHandler(handler: HttpHandler): void {
    this.handlers.push(handler);
  }

  start(): void {
    if (this.server) {
      return;
    }

    this.server = createServer(async (req, res) => {
      // Try registered handlers first
      for (const handler of this.handlers) {
        try {
          const handled = await handler.handle(req, res);
          if (handled) {
            return;
          }
        } catch (error) {
          console.error("HTTP handler error:", error);
          if (!res.headersSent) {
            res.writeHead(500);
            res.end();
          }
          return;
        }
      }

      // Default routes
      if (req.url === "/health" || req.url === "/") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    this.server.listen(this.config.port, this.config.host, () => {
      console.log(`HTTP server listening on ${this.config.host}:${this.config.port}`);
    });
  }

  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  isRunning(): boolean {
    return this.server !== null;
  }
}
