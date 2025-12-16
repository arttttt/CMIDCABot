/**
 * Protocol handler - routes messages to command handlers
 *
 * This is the unified entry point for all UI interactions.
 * Uses CommandRegistry to get available commands and handlers.
 */

import { InitUserUseCase } from "../../domain/usecases/index.js";
import { HelpFormatter } from "../formatters/index.js";
import { CommandRegistry } from "../commands/types.js";
import { UIResponse, UIMessageContext, UICallbackContext, UICommand } from "./types.js";

export class ProtocolHandler {
  private helpFormatter: HelpFormatter;

  constructor(
    private registry: CommandRegistry,
    private initUser: InitUserUseCase,
  ) {
    this.helpFormatter = new HelpFormatter();
  }

  /**
   * Get available commands for this mode
   * Used by Telegram bot to register commands
   */
  getAvailableCommands(): UICommand[] {
    return this.registry.getDefinitions().map((def) => ({
      name: def.name,
      description: def.description,
    }));
  }

  /**
   * Handle incoming message
   */
  async handleMessage(ctx: UIMessageContext): Promise<UIResponse> {
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
    const definitions = this.registry.getDefinitions();
    const modeInfo = this.registry.getModeInfo();

    // /start - initialize user
    if (command === "/start") {
      await this.initUser.execute(telegramId);
      return {
        text: this.helpFormatter.formatStartMessage(modeInfo),
      };
    }

    // /help [command] - show available commands or specific command help
    if (command === "/help") {
      const helpTarget = args[0]?.toLowerCase();

      // /help <command> - show help for specific command
      if (helpTarget) {
        const commandHelp = this.helpFormatter.formatCommandHelp(helpTarget, this.registry);
        if (commandHelp) {
          return { text: commandHelp };
        }
        return { text: `Unknown command: /${helpTarget}\nUse /help to see available commands.` };
      }

      // /help - show all commands
      return {
        text: this.helpFormatter.formatHelp(definitions, modeInfo),
      };
    }

    // Extract command name (remove leading /)
    const commandName = command.slice(1);

    // Look up handler in registry
    const handler = this.registry.getHandler(commandName);
    if (!handler) {
      return { text: `Unknown command: ${command}\nUse /help to see available commands.` };
    }

    return handler(args, telegramId);
  }

  /**
   * Handle callback query (button press)
   */
  async handleCallback(_ctx: UICallbackContext): Promise<UIResponse> {
    return { text: "Unknown action." };
  }
}
