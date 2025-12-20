/**
 * DCA Wallet formatter - domain objects to UI response
 */

import {
  ShowWalletResult,
  CreateWalletResult,
  ImportWalletResult,
  DeleteWalletResult,
  ExportKeyResult,
  DcaWalletInfo,
} from "../../domain/usecases/types.js";
import { UIResponse } from "../protocol/types.js";
import { Markdown } from "./markdown.js";

export class DcaWalletFormatter {
  private formatWalletInfo(wallet: DcaWalletInfo): string {
    const lines: string[] = [];

    lines.push(`Address: ${Markdown.code(wallet.address)}`);

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

  formatShowWallet(result: ShowWalletResult): UIResponse {
    switch (result.type) {
      case "success":
      case "dev_mode":
        return {
          text:
            `**DCA Wallet**\n\n` +
            this.formatWalletInfo(result.wallet!) +
            `\n\nDeposit SOL to this address to fund your DCA purchases.\n\n` +
            `_Commands: /wallet export | /wallet delete_`,
        };

      case "no_wallet":
        return {
          text:
            `No wallet found.\n\n` +
            `Use /wallet create to generate a new wallet\n` +
            `or /wallet import <key> to import existing one.`,
        };

      default:
        return { text: "Unable to retrieve wallet information." };
    }
  }

  formatCreateWallet(result: CreateWalletResult, seedTtlMinutes?: number): UIResponse {
    switch (result.type) {
      case "created": {
        if (result.seedUrl) {
          const ttl = seedTtlMinutes ?? 5;
          return {
            text:
              `**Wallet Created!**\n\n` +
              this.formatWalletInfo(result.wallet!) +
              `\n\n**Recovery Phrase:**\n` +
              `Your seed phrase is available via secure one-time link.\n\n` +
              `**IMPORTANT:**\n` +
              `- Link expires in ${ttl} minutes\n` +
              `- Link works only ONCE\n` +
              `- Write down the phrase and store offline\n` +
              `- Compatible with Phantom, Solflare, and other Solana wallets`,
            buttons: [[{ text: "View Recovery Phrase", url: result.seedUrl }]],
          };
        }

        return {
          text:
            `**Wallet Created!**\n\n` +
            this.formatWalletInfo(result.wallet!) +
            `\n\nDeposit SOL to this address to fund your DCA purchases.\n\n` +
            `**Important:** Use /wallet export to backup your private key.`,
        };
      }

      case "already_exists":
        return {
          text:
            `Wallet already exists.\n\n` +
            this.formatWalletInfo(result.wallet!) +
            `\n\nTo create a new wallet, first delete the existing one with /wallet delete.`,
        };

      case "dev_mode":
        return {
          text:
            `[DEV MODE] Cannot create wallets.\n\n` +
            `Using shared development wallet:\n` +
            this.formatWalletInfo(result.wallet!),
        };

      default:
        return { text: "Unable to create wallet." };
    }
  }

  formatDeleteWallet(result: DeleteWalletResult): UIResponse {
    switch (result.type) {
      case "deleted":
        return {
          text:
            `Wallet deleted.\n\n` +
            `Your private key has been removed. ` +
            `Make sure you have backed it up if you need to recover funds.\n\n` +
            `Use /wallet create to generate a new wallet.`,
        };

      case "no_wallet":
        return {
          text: `No wallet to delete.`,
        };

      case "dev_mode":
        return {
          text: `[DEV MODE] Cannot delete shared development wallet.`,
        };

      default:
        return { text: "Unable to delete wallet." };
    }
  }

  formatExportKey(result: ExportKeyResult, commandPath: string): UIResponse {
    // First step: show confirmation screen (don't show key yet)
    switch (result.type) {
      case "success":
      case "dev_mode":
        return {
          text:
            `**Export Private Key?**\n\n` +
            `**WARNING:** Your private key will be shown in this chat.\n\n` +
            `**Security risks:**\n` +
            `- The key may remain in chat history\n` +
            `- Anyone with access to this chat can see it\n` +
            `- Never share your private key with anyone\n\n` +
            `Are you sure you want to export?`,
          buttons: [[{ text: "Yes, show my private key", callbackData: `${commandPath}:confirm_export` }]],
        };

      case "no_wallet":
        return {
          text:
            `No wallet found.\n\n` +
            `Use /wallet create to generate a wallet first.`,
        };

      default:
        return { text: "Unable to export private key." };
    }
  }

  formatExportKeyConfirmed(result: ExportKeyResult): UIResponse {
    // Second step: show the actual key with clear button
    const clearButton = [[{ text: "✓ I saved it", callbackData: "delete_sensitive" }]];

    switch (result.type) {
      case "success":
        return {
          text:
            `**Private Key Export**\n\n` +
            `**SECURITY WARNING**\n` +
            `- Never share this key with anyone\n` +
            `- Anyone with this key can access your funds\n` +
            `- Store it securely offline\n\n` +
            `Private Key (base64):\n` +
            `${Markdown.code(result.privateKey ?? "")}\n\n` +
            `_Press the button below after saving to clear this message._`,
          buttons: clearButton,
        };

      case "dev_mode":
        return {
          text:
            `**Private Key Export (DEV MODE)**\n\n` +
            `You are using a shared development wallet.\n` +
            `This key is configured via DEV_WALLET_PRIVATE_KEY.\n\n` +
            `Private Key (base64):\n` +
            `${Markdown.code(result.privateKey ?? "")}\n\n` +
            `_Press the button below after saving to clear this message._`,
          buttons: clearButton,
        };

      case "no_wallet":
        return {
          text:
            `No wallet found.\n\n` +
            `Use /wallet create to generate a wallet first.`,
        };

      default:
        return { text: "Unable to export private key." };
    }
  }

  formatImportWallet(result: ImportWalletResult): UIResponse {
    // Always delete user's message containing private key for security
    const deleteUserMessage = true;
    const securityNotice = `\n\n**Security:** Your message with the private key has been deleted.`;

    switch (result.type) {
      case "imported":
        return {
          text:
            `**Wallet Imported!**\n\n` +
            this.formatWalletInfo(result.wallet!) +
            `\n\nYour wallet has been successfully imported.\n\n` +
            `**Note:** Your private key is stored securely for DCA operations.` +
            securityNotice,
          deleteUserMessage,
        };

      case "already_exists":
        return {
          text:
            `Wallet already exists.\n\n` +
            this.formatWalletInfo(result.wallet!) +
            `\n\nTo import a different wallet, first delete the existing one with /wallet delete.` +
            securityNotice,
          deleteUserMessage,
        };

      case "invalid_key":
        return {
          text:
            `**Invalid Key or Mnemonic**\n\n` +
            `${Markdown.escape(result.error || "The provided input is not a valid Solana private key or mnemonic.")}\n\n` +
            `**Supported formats:**\n` +
            `- Recovery phrase: 12 or 24 words\n` +
            `- Private key: base64-encoded (32 or 64 bytes)\n\n` +
            `**Examples:**\n` +
            `${Markdown.code("/wallet import word1 word2 ... word12")}\n` +
            `${Markdown.code("/wallet import ABC123...xyz=")}\n\n` +
            `**Note:** Only Solana wallets are supported. Ethereum and other chain keys will not work.` +
            securityNotice,
          deleteUserMessage,
        };

      case "dev_mode":
        return {
          text:
            `[DEV MODE] Cannot import wallets.\n\n` +
            `Using shared development wallet:\n` +
            this.formatWalletInfo(result.wallet!) +
            securityNotice,
          deleteUserMessage,
        };

      default:
        return { text: "Unable to import wallet.", deleteUserMessage };
    }
  }

  formatImportUsage(): UIResponse {
    return {
      text:
        `**Import Wallet Usage**\n\n` +
        `/wallet import <recovery_phrase or private_key>\n\n` +
        `**Supported formats:**\n` +
        `- Recovery phrase (12 or 24 words) - compatible with Phantom, Solflare\n` +
        `- Base64-encoded private key\n\n` +
        `**Examples:**\n` +
        `/wallet import word1 word2 word3 ... word12\n` +
        `/wallet import ABC123...xyz=\n\n` +
        `**Security:**\n` +
        `- Your message with the key will be automatically deleted\n` +
        `- Only import keys you trust\n` +
        `- The key will be stored securely for DCA operations`,
    };
  }

  formatUnknownSubcommand(): UIResponse {
    return {
      text:
        `Unknown wallet command.\n\n` +
        `Available commands:\n` +
        `/wallet - Show current wallet\n` +
        `/wallet create - Create new wallet\n` +
        `/wallet import <key> - Import existing wallet\n` +
        `/wallet export - Export private key\n` +
        `/wallet delete - Delete wallet`,
    };
  }
}
