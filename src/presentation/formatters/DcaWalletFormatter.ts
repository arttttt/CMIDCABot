/**
 * DCA Wallet formatter - domain objects to UI response
 */

import { DcaWalletResult, ExportKeyResult, DcaWalletInfo } from "../../domain/usecases/types.js";
import { UIResponse } from "../protocol/types.js";

export class DcaWalletFormatter {
  private formatWalletInfo(wallet: DcaWalletInfo): string {
    const lines: string[] = [];

    lines.push(`Address: \`${wallet.address}\``);

    if (wallet.balance !== null) {
      lines.push(`Balance: ${wallet.balance.toFixed(4)} SOL`);
    } else {
      lines.push(`Balance: Unable to fetch`);
    }

    if (wallet.isDevWallet) {
      lines.push(`\n[DEV MODE] Using shared development wallet`);
    }

    return lines.join("\n");
  }

  formatShowWallet(result: DcaWalletResult): UIResponse {
    switch (result.type) {
      case "success":
        return {
          text:
            `**DCA Wallet**\n\n` +
            this.formatWalletInfo(result.wallet!) +
            `\n\nDeposit SOL to this address to fund your DCA purchases.`,
        };

      case "generated":
        return {
          text:
            `**New DCA Wallet Created!**\n\n` +
            this.formatWalletInfo(result.wallet!) +
            `\n\nThis wallet was just generated for you. ` +
            `Deposit SOL to this address to fund your DCA purchases.\n\n` +
            `Use /export_key to backup your private key.`,
        };

      case "no_wallet":
        return {
          text:
            `No DCA wallet found.\n\n` +
            `Use /dcawallet to create one automatically.`,
        };

      default:
        return { text: "Unable to retrieve DCA wallet information." };
    }
  }

  formatExportKey(result: ExportKeyResult): UIResponse {
    switch (result.type) {
      case "success":
        return {
          text:
            `**Private Key Export**\n\n` +
            `**SECURITY WARNING**\n` +
            `- Never share this key with anyone\n` +
            `- Anyone with this key can access your funds\n` +
            `- Store it securely offline\n` +
            `- Delete this message after saving\n\n` +
            `Private Key (base64):\n` +
            `\`${result.privateKey}\``,
        };

      case "dev_mode":
        return {
          text:
            `**Private Key Export (DEV MODE)**\n\n` +
            `You are using a shared development wallet.\n` +
            `This key is configured via DEV_WALLET_PRIVATE_KEY.\n\n` +
            `Private Key (base64):\n` +
            `\`${result.privateKey}\``,
        };

      case "no_wallet":
        return {
          text:
            `No DCA wallet found.\n\n` +
            `Use /dcawallet to create a wallet first.`,
        };

      default:
        return { text: "Unable to export private key." };
    }
  }
}
