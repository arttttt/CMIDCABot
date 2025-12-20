/**
 * Health check HTTP server for container orchestration platforms
 * Provides a minimal endpoint for liveness/readiness probes (Koyeb, Kubernetes, etc.)
 *
 * Also handles /seed/:token routes for one-time seed phrase display.
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import type { HealthConfig } from "../types/config.js";

export interface HttpHandler {
  handle(req: IncomingMessage, res: ServerResponse): Promise<boolean>;
}

export class HealthService {
  private server: Server | null = null;
  private readonly config: HealthConfig;
  private handlers: HttpHandler[] = [];

  constructor(config: HealthConfig) {
    this.config = config;
  }

  /**
   * Register an additional HTTP handler
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
        const handled = await handler.handle(req, res);
        if (handled) {
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
      console.log(`Health check server listening on port ${this.config.port}`);
    });
  }

  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}
