/**
 * Command architecture exports
 *
 * Three-layer separation:
 * 1. Definitions - describes what commands do (data)
 * 2. Handlers - command execution logic (functions)
 * 3. Registries - compose definitions + handlers for mode
 */

// Types
export type {
  CommandDefinition,
  CommandHandler,
  CallbackHandler,
  CommandEntry,
  CommandRegistry,
  ModeInfo,
  SubcommandDefinition,
} from "./types.js";

// Definitions
export { Definitions, type DefinitionKey } from "./definitions.js";

// Handler factories
export {
  createWalletEntry,
  createDcaHandler,
  createPortfolioHandler,
  createPricesHandler,
  createSwapHandler,
  type WalletHandlerDeps,
  type DcaHandlerDeps,
  type PortfolioHandlerDeps,
  type PricesHandlerDeps,
  type SwapHandlerDeps,
} from "./handlers.js";

// Registries
export { DevCommandRegistry, type DevCommandRegistryDeps } from "./DevCommandRegistry.js";
export { ProdCommandRegistry, type ProdCommandRegistryDeps } from "./ProdCommandRegistry.js";
