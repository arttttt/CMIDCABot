/**
 * Help formatter - format help and start messages
 */

import { UICommand } from "../protocol/types.js";

export class HelpFormatter {
  formatHelp(commands: UICommand[], isDev: boolean): string {
    const commandList = commands
      .map((cmd) => `/${cmd.name} - ${cmd.description}`)
      .join("\n");

    let text =
      "Healthy Crypto Index DCA Bot\n\n" +
      "Target allocations:\n" +
      "- BTC: 40%\n" +
      "- ETH: 30%\n" +
      "- SOL: 30%\n\n" +
      "Commands:\n" +
      commandList +
      "\n\n" +
      "The bot purchases the asset furthest below its target allocation.";

    if (isDev) {
      text += "\n\nNote: In development mode, purchases are simulated without real swaps.";
    }

    return text;
  }

  formatStartMessage(commands: UICommand[]): string {
    const commandList = commands
      .map((cmd) => `/${cmd.name} - ${cmd.description}`)
      .join("\n");

    return "DCA Bot for Solana\n\n" + "Commands:\n" + commandList;
  }
}
