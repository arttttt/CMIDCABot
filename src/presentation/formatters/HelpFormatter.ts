/**
 * Help formatter - format help and start messages
 *
 * Uses Command structure to generate help recursively.
 */

import { Command, ModeInfo } from "../commands/types.js";

export class HelpFormatter {
  /**
   * Format full help message from Command structure
   */
  formatHelp(commands: Map<string, Command>, modeInfo: ModeInfo | null): string {
    let text = "**CMI DCA Bot**\n\n";
    text += "Target allocations:\n";
    text += "- BTC: 40%\n";
    text += "- ETH: 30%\n";
    text += "- SOL: 30%\n\n";
    text += "The bot purchases the asset furthest below its target allocation.\n\n";
    text += "**Commands**\n\n";

    for (const cmd of commands.values()) {
      text += this.formatCommandHelp(cmd, `/${cmd.definition.name}`);
    }

    if (modeInfo) {
      text += `[${modeInfo.label}]\n${modeInfo.description}`;
    }

    return text;
  }

  /**
   * Format help for a single command (recursive)
   */
  private formatCommandHelp(cmd: Command, prefix: string): string {
    let text = `**${prefix}** - ${cmd.definition.description}\n`;

    if (cmd.subcommands && cmd.subcommands.size > 0) {
      for (const [name, sub] of cmd.subcommands) {
        text += `  \`${prefix} ${name}\` - ${sub.definition.description}\n`;
      }
    }

    text += "\n";
    return text;
  }

  /**
   * Format start message
   */
  formatStartMessage(modeInfo: ModeInfo | null): string {
    const isDev = modeInfo !== null;

    let text = "**CMI DCA Bot**\n\n";
    text += "Automated Crypto Majors Index DCA on Solana.\n\n";
    text += "**Quick Start:**\n";
    text += "1. `/wallet create` - Create your wallet\n";
    text += "2. Deposit SOL to fund transactions\n";
    if (isDev) {
      text += "3. `/dca start` - Enable automatic purchases\n";
    }
    text += "\nUse `/help` for full command reference.";
    return text;
  }
}
