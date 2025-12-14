/**
 * Help formatter - format help and start messages
 */

interface SubcommandInfo {
  command: string;
  description: string;
}

interface CommandHelpDetails {
  name: string;
  description: string;
  subcommands?: SubcommandInfo[];
}

export class HelpFormatter {
  private getCommandDetails(isDev: boolean): CommandHelpDetails[] {
    const commands: CommandHelpDetails[] = [
      {
        name: "wallet",
        description: "Manage your DCA wallet",
        subcommands: [
          { command: "/wallet", description: "Show current wallet" },
          { command: "/wallet create", description: "Create new wallet" },
          { command: "/wallet import <key>", description: "Import existing wallet" },
          { command: "/wallet export", description: "Export private key" },
          { command: "/wallet delete", description: "Delete wallet" },
        ],
      },
    ];

    if (isDev) {
      commands.push(
        {
          name: "dca",
          description: "Manage automatic purchases",
          subcommands: [
            { command: "/dca", description: "Show DCA status" },
            { command: "/dca start", description: "Start automatic purchases" },
            { command: "/dca stop", description: "Stop automatic purchases" },
          ],
        },
        {
          name: "portfolio",
          description: "Portfolio status and manual purchases",
          subcommands: [
            { command: "/portfolio", description: "Show portfolio status" },
            { command: "/portfolio buy <usdc>", description: "Buy asset for USDC amount" },
          ],
        },
        {
          name: "prices",
          description: "Show current asset prices (BTC, ETH, SOL)",
        },
        {
          name: "swap",
          description: "Manual swap operations via Jupiter",
          subcommands: [
            { command: "/swap quote <usdc> [asset]", description: "Get swap quote (read-only)" },
            { command: "/swap simulate <usdc> [asset]", description: "Simulate swap transaction" },
            { command: "/swap execute <usdc> [asset]", description: "Execute real swap" },
          ],
        },
      );
    }

    return commands;
  }

  formatHelp(isDev: boolean): string {
    const details = this.getCommandDetails(isDev);

    let text = "**CMI DCA Bot**\n\n";
    text += "Target allocations:\n";
    text += "- BTC: 40%\n";
    text += "- ETH: 30%\n";
    text += "- SOL: 30%\n\n";
    text += "The bot purchases the asset furthest below its target allocation.\n\n";
    text += "─".repeat(30) + "\n";
    text += "**Commands**\n";
    text += "─".repeat(30) + "\n\n";

    for (const cmd of details) {
      text += `**/${cmd.name}** - ${cmd.description}\n`;
      if (cmd.subcommands) {
        for (const sub of cmd.subcommands) {
          text += `  \`${sub.command}\`\n`;
          text += `    ${sub.description}\n`;
        }
      }
      text += "\n";
    }

    if (isDev) {
      text += "─".repeat(30) + "\n";
      text += "_Development mode: purchases are simulated._";
    }

    return text;
  }

  formatStartMessage(isDev: boolean = false): string {
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

  formatCommandHelp(commandName: string, isDev: boolean): string | null {
    const details = this.getCommandDetails(isDev);
    const cmd = details.find((c) => c.name === commandName);

    if (!cmd) {
      return null;
    }

    let text = `**/${cmd.name}** - ${cmd.description}\n\n`;

    if (cmd.subcommands) {
      text += "**Subcommands:**\n";
      for (const sub of cmd.subcommands) {
        text += `\`${sub.command}\`\n`;
        text += `  ${sub.description}\n\n`;
      }
    } else {
      text += `Usage: \`/${cmd.name}\``;
    }

    return text;
  }
}
