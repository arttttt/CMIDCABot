/**
 * Command architecture exports
 *
 * Only the registries are the module's public surface;
 * commands, router and dependencies are internal wiring.
 */

export type { CommandRegistry } from "./types.js";
export { DevCommandRegistry, type DevCommandRegistryDeps } from "./DevCommandRegistry.js";
export { ProdCommandRegistry, type ProdCommandRegistryDeps } from "./ProdCommandRegistry.js";
