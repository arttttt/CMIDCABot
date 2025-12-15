/**
 * Help formatter - format help and start messages
 *
 * Uses CommandDefinition from registry to generate help.
 */

import { CommandDefinition, CommandRegistry, ModeInfo } from "../commands/types.js";

export class HelpFormatter {
  /**
   * Format full help message using definitions from registry
   */
  formatHelp(definitions: CommandDefinition[], modeInfo: ModeInfo): string {
    let text = "**CMI DCA Bot**\n\n";
    text += "Target allocations:\n";
    text += "- BTC: 40%\n";
    text += "- ETH: 30%\n";
    text += "- SOL: 30%\n\n";
    text += "The bot purchases the asset furthest below its target allocation.\n\n";
    text += "─".repeat(30) + "\n";
    text += "**Commands**\n";
    text += "─".repeat(30) + "\n\n";

    for (const cmd of definitions) {
      text += `**/${cmd.name}** - ${cmd.description}\n`;
      if (cmd.subcommands) {
        for (const sub of cmd.subcommands) {
          text += `  \`${sub.usage}\`\n`;
          text += `    ${sub.description}\n`;
        }
      }
      text += "\n";
    }

    text += "─".repeat(30) + "\n";
    text += `_Mode: ${modeInfo.label}_\n`;
    text += `_${modeInfo.description}_`;

    return text;
  }

  /**
   * Format start message
   */
  formatStartMessage(modeInfo: ModeInfo): string {
    const isDev = modeInfo.label === "Development";

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

  /**
   * Format help for a specific command (O(1) lookup via registry)
   */
  formatCommandHelp(commandName: string, registry: CommandRegistry): string | null {
    const cmd = registry.getDefinition(commandName);

    if (!cmd) {
      return null;
    }

    let text = `**/${cmd.name}** - ${cmd.description}\n\n`;

    if (cmd.subcommands) {
      text += "**Subcommands:**\n";
      for (const sub of cmd.subcommands) {
        text += `\`${sub.usage}\`\n`;
        text += `  ${sub.description}\n\n`;
      }
    } else {
      text += `Usage: \`/${cmd.name}\``;
    }

    return text;
  }
}
