/**
 * Protocol handler - routes messages to command handlers
 *
 * This is the unified entry point for all UI interactions.
 * Uses CommandRegistry to get available commands and routes them.
 * Includes authorization checks for all commands.
 */

import { InitUserUseCase } from "../../domain/usecases/index.js";
import { HelpFormatter } from "../formatters/index.js";
import { CommandRegistry } from "../commands/types.js";
import { routeCommand, findCallbackByPath } from "../commands/router.js";
import { UIResponse, UIMessageContext, UICallbackContext, UICommand } from "./types.js";
import { AuthorizationService } from "../../services/authorization.js";

const UNAUTHORIZED_MESSAGE = `You are not authorized to use this bot.

Please contact the administrator to request access.`;

export class ProtocolHandler {
  private helpFormatter: HelpFormatter;

  constructor(
    private registry: CommandRegistry,
    private initUser: InitUserUseCase,
    private authService: AuthorizationService,
  ) {
    this.helpFormatter = new HelpFormatter();
  }

  /**
   * Get available commands for this mode
   * Used by Telegram bot to register commands
   */
  getAvailableCommands(): UICommand[] {
    const commands: UICommand[] = [];
    for (const cmd of this.registry.getCommands().values()) {
      commands.push({
        name: cmd.definition.name,
        description: cmd.definition.description,
      });
    }
    return commands;
  }

  /**
   * Handle incoming message
   */
  async handleMessage(ctx: UIMessageContext): Promise<UIResponse> {
    // Check authorization first
    const isAuthorized = await this.authService.isAuthorized(ctx.telegramId);
    if (!isAuthorized) {
      return { text: UNAUTHORIZED_MESSAGE };
    }

    const text = ctx.text.trim();

    if (text.startsWith("/")) {
      const parts = text.split(/\s+/);
      const command = parts[0].toLowerCase();
      const args = parts.slice(1);
      return this.handleCommand(command, args, ctx.telegramId);
    }

    return { text: "Unknown command. Use /help to see available commands." };
  }

  private async handleCommand(
    command: string,
    args: string[],
    telegramId: number,
  ): Promise<UIResponse> {
    const modeInfo = this.registry.getModeInfo();

    // /start - initialize user
    if (command === "/start") {
      await this.initUser.execute(telegramId);
      return {
        text: this.helpFormatter.formatStartMessage(modeInfo),
      };
    }

    // /help - show all available commands
    if (command === "/help") {
      return {
        text: this.helpFormatter.formatHelp(this.registry.getCommands(), modeInfo),
      };
    }

    // Extract command name (remove leading /)
    const commandName = command.slice(1);

    // Look up command in registry
    const cmd = this.registry.getCommand(commandName);
    if (!cmd) {
      return { text: `Unknown command: ${command}\nUse /help to see available commands.` };
    }

    // Route through command tree
    return routeCommand(cmd, args, telegramId);
  }

  /**
   * Handle callback query (button press)
   */
  async handleCallback(ctx: UICallbackContext): Promise<UIResponse> {
    // Check authorization first
    const isAuthorized = await this.authService.isAuthorized(ctx.telegramId);
    if (!isAuthorized) {
      return { text: UNAUTHORIZED_MESSAGE };
    }

    const handler = findCallbackByPath(this.registry.getCommands(), ctx.callbackData);
    if (handler) {
      return handler(ctx.telegramId);
    }
    return { text: "Unknown action." };
  }

  /**
   * Get authorization service (for admin commands)
   */
  getAuthService(): AuthorizationService {
    return this.authService;
  }
}
