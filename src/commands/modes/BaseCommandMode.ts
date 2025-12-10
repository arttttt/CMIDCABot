/**
 * Base abstract class for command modes
 */

import { CommandMode, CommandDefinition, CommandHandler } from "../../types/commands.js";

export abstract class BaseCommandMode implements CommandMode {
  protected commands: Map<string, CommandDefinition> = new Map();

  protected registerCommand(definition: CommandDefinition): void {
    this.commands.set(`/${definition.name}`, definition);
  }

  getCommands(): CommandDefinition[] {
    return Array.from(this.commands.values());
  }

  getHandler(command: string): CommandHandler | undefined {
    return this.commands.get(command.toLowerCase())?.handler;
  }

  getHelpText(): string {
    const commandList = this.getCommands()
      .map((cmd) => `/${cmd.name} - ${cmd.description}`)
      .join("\n");

    return (
      "Healthy Crypto Index DCA Bot\n\n" +
      "Target allocations:\n" +
      "- BTC: 40%\n" +
      "- ETH: 30%\n" +
      "- SOL: 30%\n\n" +
      "Commands:\n" +
      commandList +
      "\n\n" +
      "The bot purchases the asset furthest below its target allocation."
    );
  }

  getStartMessage(): string {
    const commandList = this.getCommands()
      .map((cmd) => `/${cmd.name} - ${cmd.description}`)
      .join("\n");

    return "DCA Bot for Solana\n\n" + "Commands:\n" + commandList;
  }
}
