/**
 * Minimal health check server for production deployments
 * Required by platforms like Koyeb that need HTTP health checks
 */

import { createServer, type Server } from "node:http";

export function startHealthServer(port: number): Server {
  const server = createServer((req, res) => {
    if (req.url === "/health" || req.url === "/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  // Listen on 0.0.0.0 to accept connections from outside the container
  server.listen(port, "0.0.0.0", () => {
    console.log(`Health check server listening on port ${port}`);
  });

  return server;
}
