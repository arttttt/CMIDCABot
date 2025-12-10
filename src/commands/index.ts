/**
 * Commands module - provides command modes and handlers
 */

import { CommandMode } from "../types/commands.js";
import { DevCommandMode, ProdCommandMode } from "./modes/index.js";

export { DevCommandMode, ProdCommandMode } from "./modes/index.js";
export * from "./handlers/index.js";

/**
 * Factory function to create the appropriate command mode based on environment
 */
export function createCommandMode(isDev: boolean): CommandMode {
  return isDev ? new DevCommandMode() : new ProdCommandMode();
}
