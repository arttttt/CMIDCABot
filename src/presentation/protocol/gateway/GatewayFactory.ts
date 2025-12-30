/**
 * GatewayFactory - factory for creating configured Gateway instances
 *
 * Assembles Gateway with plugins and handlers.
 * Single entry point for Gateway construction.
 */

import type { GetUserRoleUseCase } from "../../../domain/usecases/GetUserRoleUseCase.js";
import type { CommandRegistry } from "../../commands/types.js";
import { Gateway } from "./Gateway.js";
import { GatewayCore } from "./GatewayCore.js";
import { TelegramMessageHandler } from "./handlers/TelegramMessageHandler.js";
import { TelegramCallbackHandler } from "./handlers/TelegramCallbackHandler.js";
import { HttpRequestHandler } from "./handlers/HttpRequestHandler.js";
import { ErrorBoundaryPlugin } from "./plugins/ErrorBoundaryPlugin.js";
import { LoadRolePlugin } from "./plugins/LoadRolePlugin.js";

/**
 * Dependencies for creating Gateway
 */
export interface GatewayFactoryDeps {
  getUserRole: GetUserRoleUseCase;
  commandRegistry: CommandRegistry;
}

/**
 * Factory for creating configured Gateway instances
 */
export class GatewayFactory {
  /**
   * Create configured Gateway instance
   *
   * Assembles Gateway with:
   * - Plugins: ErrorBoundary (outermost), LoadRole
   * - Handlers: TelegramMessage, TelegramCallback, Http
   *
   * Plugin chain order (execution):
   * Request → ErrorBoundary → LoadRole → GatewayCore → Handlers
   */
  static create(deps: GatewayFactoryDeps): Gateway {
    const handlers = [
      new TelegramMessageHandler(deps.commandRegistry),
      new TelegramCallbackHandler(deps.commandRegistry),
      new HttpRequestHandler(),
    ];

    const core = new GatewayCore(handlers);

    const plugins = [
      new ErrorBoundaryPlugin(),
      new LoadRolePlugin(deps.getUserRole),
    ];

    return new Gateway(core, plugins);
  }
}
