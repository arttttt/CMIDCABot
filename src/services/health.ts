/**
 * Health check HTTP server for container orchestration platforms
 * Provides a minimal endpoint for liveness/readiness probes (Koyeb, Kubernetes, etc.)
 */

import { createServer, type Server } from "node:http";

export interface HealthServerConfig {
  port: number;
  host?: string;
}

export class HealthService {
  private server: Server | null = null;
  private readonly config: Required<HealthServerConfig>;

  constructor(config: HealthServerConfig) {
    this.config = {
      port: config.port,
      host: config.host ?? "0.0.0.0",
    };
  }

  start(): void {
    if (this.server) {
      return;
    }

    this.server = createServer((req, res) => {
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
