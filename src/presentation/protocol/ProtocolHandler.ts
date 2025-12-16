/**
 * Protocol handler - routes messages to command handlers
 *
 * This is the unified entry point for all UI interactions.
 * Uses CommandRegistry to get available commands and routes them.
 * Includes authorization checks for all commands.
 */

import { InitUserUseCase } from "../../domain/usecases/index.js";
import { HelpFormatter } from "../formatters/index.js";
import { CommandRegistry, Command } from "../commands/types.js";
import { routeCommand, findCallbackByPath } from "../commands/router.js";
import { UIResponse, UIMessageContext, UICallbackContext, UICommand } from "./types.js";
import { AuthorizationService } from "../../services/authorization.js";

const UNAUTHORIZED_MESSAGE = `You are not authorized to use this bot.

Please contact the administrator to request access.`;

/**
 * Commands that require admin privileges
 */
const ADMIN_ONLY_COMMANDS = new Set(["admin"]);

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
    const isAdmin = await this.authService.isAdmin(telegramId);

    // /start - initialize user
    if (command === "/start") {
      await this.initUser.execute(telegramId);
      return {
        text: this.helpFormatter.formatStartMessage(modeInfo),
      };
    }

    // /help - show commands available to user based on role
    if (command === "/help") {
      const availableCommands = this.filterCommandsByRole(this.registry.getCommands(), isAdmin);
      return {
        text: this.helpFormatter.formatHelp(availableCommands, modeInfo),
      };
    }

    // Extract command name (remove leading /)
    const commandName = command.slice(1);

    // Check if command requires admin privileges
    if (ADMIN_ONLY_COMMANDS.has(commandName) && !isAdmin) {
      // Return "unknown command" to hide admin commands from non-admins
      return { text: `Unknown command: ${command}\nUse /help to see available commands.` };
    }

    // Look up command in registry
    const cmd = this.registry.getCommand(commandName);
    if (!cmd) {
      return { text: `Unknown command: ${command}\nUse /help to see available commands.` };
    }

    // Route through command tree
    return routeCommand(cmd, args, telegramId);
  }

  /**
   * Filter commands based on user role
   */
  private filterCommandsByRole(commands: Map<string, Command>, isAdmin: boolean): Map<string, Command> {
    if (isAdmin) {
      return commands; // Admins see all commands
    }

    // Filter out admin-only commands for regular users
    const filtered = new Map<string, Command>();
    for (const [name, cmd] of commands) {
      if (!ADMIN_ONLY_COMMANDS.has(name)) {
        filtered.set(name, cmd);
      }
    }
    return filtered;
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
