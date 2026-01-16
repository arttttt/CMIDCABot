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

// Command factories (exporting types from dependencies)
export type {
  WalletCommandDeps,
  DcaCommandDeps,
  PortfolioCommandDeps,
  PricesCommandDeps,
  SwapCommandDeps,
  AdminCommandDeps,
  StartCommandDeps,
  VersionCommandDeps,
  HelpCommandDeps,
  HelpCommandExternalDeps,
} from "./dependencies.js";

export {
  WalletCommand,
  DcaCommand,
  PortfolioCommand,
  PricesCommand,
  SwapCommand,
  AdminCommand,
  StartCommand,
  VersionCommand,
  HelpCommand,
} from "./handlers/index.js";

// Registries
export { DevCommandRegistry, type DevCommandRegistryDeps } from "./DevCommandRegistry.js";
export { ProdCommandRegistry, type ProdCommandRegistryDeps } from "./ProdCommandRegistry.js";
