/**
 * Wallet formatter - domain objects to UI response
 */

import {
  SetWalletResult,
  RemoveWalletResult,
  WalletCallbackResult,
  WalletInfo,
} from "../../domain/usecases/types.js";
import { UIResponse } from "../protocol/types.js";

export class WalletFormatter {
  private formatWalletInfo(wallet: WalletInfo): string {
    if (wallet.balance !== null) {
      return (
        `Address: ${wallet.address}\n` +
        `Balance: ${wallet.balance.toFixed(4)} SOL`
      );
    }
    return (
      `Address: ${wallet.address}\n` +
      `Balance: Unable to fetch (wallet may be new or network issue)`
    );
  }

  formatShowWallet(result: SetWalletResult): UIResponse {
    if (result.type === "needs_confirmation" && !result.existingAddress) {
      // No wallet connected
      return {
        text:
          "No wallet connected.\n\n" +
          "Use /wallet set <address> to connect your Solana wallet.",
      };
    }

    if (result.type === "success" && result.wallet) {
      return {
        text: `Connected wallet:\n${this.formatWalletInfo(result.wallet)}`,
      };
    }

    return { text: "Unable to retrieve wallet information." };
  }

  formatSetWallet(result: SetWalletResult): UIResponse {
    switch (result.type) {
      case "success":
        return {
          text:
            `Wallet connected successfully!\n\n` +
            this.formatWalletInfo(result.wallet!),
        };

      case "already_connected":
        return {
          text:
            `This wallet is already connected.\n\n` +
            this.formatWalletInfo(result.wallet!),
        };

      case "needs_confirmation":
        return {
          text:
            `You already have a wallet connected:\n` +
            `${result.existingAddress}\n\n` +
            `Do you want to replace it with:\n` +
            `${result.newAddress}?`,
          buttons: [
            [
              { text: "Yes, replace", callbackData: `wallet_replace:${result.newAddress}` },
              { text: "Cancel", callbackData: "wallet_cancel" },
            ],
          ],
        };

      default:
        return { text: "Unable to set wallet." };
    }
  }

  formatRemoveWallet(result: RemoveWalletResult): UIResponse {
    if (result.type === "no_wallet") {
      return { text: "No wallet is currently connected." };
    }
    return { text: "Wallet disconnected successfully." };
  }

  formatCallbackResult(result: WalletCallbackResult): UIResponse {
    switch (result.type) {
      case "replaced":
        return {
          text:
            `Wallet connected successfully!\n\n` +
            this.formatWalletInfo(result.wallet!),
        };

      case "cancelled":
        return { text: "Wallet replacement cancelled." };

      case "invalid":
        return { text: "Invalid wallet address. Please try again." };

      default:
        return { text: "Unknown action." };
    }
  }

  formatMissingAddress(): UIResponse {
    return {
      text:
        "Please provide a wallet address.\n\n" +
        "Usage: /wallet set <solana-address>\n" +
        "Example: /wallet set 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    };
  }

  formatInvalidAddress(): UIResponse {
    return {
      text:
        "Invalid Solana address.\n\n" +
        "Please provide a valid Solana wallet address (base58 encoded, 32-44 characters).",
    };
  }

  formatUnknownSubcommand(): UIResponse {
    return {
      text:
        "Unknown wallet command.\n\n" +
        "Available commands:\n" +
        "/wallet - Show current wallet\n" +
        "/wallet set <address> - Connect wallet\n" +
        "/wallet remove - Disconnect wallet",
    };
  }
}
