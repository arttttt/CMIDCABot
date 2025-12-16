/**
 * Command architecture exports
 *
 * Composable command structure:
 * - Command contains definition, handler, subcommands, and callbacks
 * - Routing traverses the command tree
 * - Registries compose commands for different modes
 */

// Types
export type {
  CommandDefinition,
  CommandHandler,
  CallbackHandler,
  Command,
  CommandRegistry,
  ModeInfo,
} from "./types.js";

// Router
export { routeCommand, prefixCallbacks, findCallbackByPath } from "./router.js";

// Definitions
export { Definitions, type DefinitionKey } from "./definitions.js";

// Command factories
export {
  createWalletCommand,
  createDcaCommand,
  createPortfolioCommand,
  createPricesCommand,
  createSwapCommand,
  type WalletCommandDeps,
  type DcaCommandDeps,
  type PortfolioCommandDeps,
  type PricesCommandDeps,
  type SwapCommandDeps,
} from "./handlers.js";

// Registries
export { DevCommandRegistry, type DevCommandRegistryDeps } from "./DevCommandRegistry.js";
export { ProdCommandRegistry, type ProdCommandRegistryDeps } from "./ProdCommandRegistry.js";
