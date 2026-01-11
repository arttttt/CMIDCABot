/**
 * Protocol handler - routes messages to command handlers
 *
 * This is the unified entry point for all UI interactions.
 * Uses CommandRegistry to get available commands and routes them.
 * Includes authorization checks for all commands.
 *
 * @deprecated Use Gateway instead. Will be removed in future version.
 * @see Gateway
 */

import { HelpFormatter } from "../formatters/index.js";
import { CommandRegistry, Command } from "../commands/types.js";
import { routeCommand, routeCommandStreaming, findCallbackByPath } from "../commands/router.js";
import {
  ClientResponse,
  UIMessageContext,
  UICallbackContext,
  UICommand,
  ClientResponseStream,
} from "./types.js";
import { TelegramId, RequestId } from "../../domain/models/id/index.js";
import { GetUserRoleUseCase } from "../../domain/usecases/index.js";
import { hasRequiredRole, type UserRole } from "../../domain/models/AuthorizedUser.js";
import { CommandExecutionContext } from "../commands/CommandExecutionContext.js";

export class ProtocolHandler {
  private helpFormatter: HelpFormatter;

  constructor(
    private registry: CommandRegistry,
    private getUserRole: GetUserRoleUseCase,
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
   * Handle incoming message (non-streaming)
   */
  async handleMessage(ctx: UIMessageContext): Promise<ClientResponse> {
    const text = ctx.text.trim();

    if (text.startsWith("/")) {
      const parts = text.split(/\s+/);
      const command = parts[0].toLowerCase();
      const args = parts.slice(1);
      return this.handleCommand(command, args, ctx.telegramId);
    }

    return new ClientResponse("Unknown command. Use /help to see available commands.");
  }

  /**
   * Handle incoming message with streaming support
   * Returns a generator that yields progress updates and final result
   */
  async *handleMessageStreaming(ctx: UIMessageContext): ClientResponseStream {
    const text = ctx.text.trim();

    if (text.startsWith("/")) {
      const parts = text.split(/\s+/);
      const command = parts[0].toLowerCase();
      const args = parts.slice(1);
      yield* this.handleCommandStreaming(command, args, ctx.telegramId);
      return;
    }

    yield {
      response: new ClientResponse("Unknown command. Use /help to see available commands."),
      mode: "final",
    };
  }

  private async handleCommand(
    command: string,
    args: string[],
    rawTelegramId: number,
  ): Promise<ClientResponse> {
    const modeInfo = this.registry.getModeInfo();
    const tgId = new TelegramId(rawTelegramId);

    // Get user role
    const userRole = await this.getUserRole.execute({ provider: "telegram", telegramId: tgId });

    // /help - show commands available to user based on role
    if (command === "/help") {
      const availableCommands = this.filterCommandsByRole(this.registry.getCommands(), userRole);
      return new ClientResponse(this.helpFormatter.formatHelp(availableCommands, modeInfo));
    }

    // Extract command name (remove leading /)
    const commandName = command.slice(1);

    // Look up command in registry
    const cmd = this.registry.getCommand(commandName);
    if (!cmd) {
      return new ClientResponse(`Unknown command: ${command}\nUse /help to see available commands.`);
    }

    // Check if user has required role for this command
    const requiredRole = cmd.requiredRole;
    if (requiredRole && !hasRequiredRole(userRole, requiredRole)) {
      // Return "unknown command" to hide restricted commands
      return new ClientResponse(`Unknown command: ${command}\nUse /help to see available commands.`);
    }

    // Route through command tree
    const execCtx = new CommandExecutionContext(
      new RequestId(crypto.randomUUID()),
      { provider: "telegram", telegramId: tgId },
      userRole,
    );
    return routeCommand(cmd, args, execCtx);
  }

  private async *handleCommandStreaming(
    command: string,
    args: string[],
    rawTelegramId: number,
  ): ClientResponseStream {
    const modeInfo = this.registry.getModeInfo();
    const tgId = new TelegramId(rawTelegramId);

    // Get user role
    const userRole = await this.getUserRole.execute({ provider: "telegram", telegramId: tgId });

    // /help - show commands available to user based on role
    if (command === "/help") {
      const availableCommands = this.filterCommandsByRole(this.registry.getCommands(), userRole);
      yield {
        response: new ClientResponse(this.helpFormatter.formatHelp(availableCommands, modeInfo)),
        mode: "final",
      };
      return;
    }

    // Extract command name (remove leading /)
    const commandName = command.slice(1);

    // Look up command in registry
    const cmd = this.registry.getCommand(commandName);
    if (!cmd) {
      yield {
        response: new ClientResponse(`Unknown command: ${command}\nUse /help to see available commands.`),
        mode: "final",
      };
      return;
    }

    // Check if user has required role for this command
    const requiredRole = cmd.requiredRole;
    if (requiredRole && !hasRequiredRole(userRole, requiredRole)) {
      // Return "unknown command" to hide restricted commands
      yield {
        response: new ClientResponse(`Unknown command: ${command}\nUse /help to see available commands.`),
        mode: "final",
      };
      return;
    }

    // Route through command tree with streaming
    const execCtx = new CommandExecutionContext(
      new RequestId(crypto.randomUUID()),
      { provider: "telegram", telegramId: tgId },
      userRole,
    );
    yield* routeCommandStreaming(cmd, args, execCtx);
  }

  /**
   * Filter commands based on user role
   */
  private filterCommandsByRole(commands: Map<string, Command>, userRole: UserRole): Map<string, Command> {
    const filtered = new Map<string, Command>();
    for (const [name, cmd] of commands) {
      const requiredRole = cmd.requiredRole;
      // Include command if no role required or user has required role
      if (!requiredRole || hasRequiredRole(userRole, requiredRole)) {
        filtered.set(name, cmd);
      }
    }
    return filtered;
  }

  /**
   * Handle callback query (button press)
   */
  async handleCallback(ctx: UICallbackContext): Promise<ClientResponse> {
    const result = findCallbackByPath(this.registry.getCommands(), ctx.callbackData);
    if (!result) {
      return new ClientResponse("Unknown action.");
    }

    const tgId = new TelegramId(ctx.telegramId);

    // Check role requirement
    const userRole = await this.getUserRole.execute({ provider: "telegram", telegramId: tgId });
    if (result.requiredRole) {
      if (!hasRequiredRole(userRole, result.requiredRole)) {
        return new ClientResponse("Unknown action.");
      }
    }

    const execCtx = new CommandExecutionContext(
      new RequestId(crypto.randomUUID()),
      { provider: "telegram", telegramId: tgId },
      userRole,
    );
    return result.handler(execCtx, result.params);
  }

}
