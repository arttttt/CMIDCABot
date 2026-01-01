/**
 * DCA Wallet formatter - domain objects to UI response
 */

import {
  GetWalletInfoResult,
  CreateWalletResult,
  ImportWalletResult,
  DeleteWalletResult,
  ExportKeyResult,
  DcaWalletInfo,
} from "../../domain/usecases/types.js";
import { ClientResponse } from "../protocol/types.js";
import { Markdown } from "./markdown.js";

export class DcaWalletFormatter {
  private formatWalletInfo(wallet: DcaWalletInfo): string {
    const lines: string[] = [];

    lines.push(`Address: ${Markdown.code(wallet.address.value)}`);

    if (wallet.balance !== null) {
      lines.push(`SOL Balance: ${wallet.balance.toFixed(4)} SOL`);
    } else {
      lines.push(`SOL Balance: Unable to fetch`);
    }

    if (wallet.usdcBalance !== null) {
      lines.push(`USDC Balance: ${wallet.usdcBalance.toFixed(2)} USDC`);
    } else {
      lines.push(`USDC Balance: Unable to fetch`);
    }

    if (wallet.isDevWallet) {
      lines.push(`\n[DEV MODE] Using shared development wallet`);
    }

    return lines.join("\n");
  }

  formatShowWallet(result: GetWalletInfoResult): ClientResponse {
    switch (result.type) {
      case "success":
      case "dev_mode":
        return new ClientResponse(
          `**DCA Wallet**\n\n` +
            this.formatWalletInfo(result.wallet!) +
            `\n\nDeposit SOL to this address to fund your DCA purchases.\n\n` +
            `_Commands: /wallet export | /wallet delete_`,
        );

      case "no_wallet":
        return new ClientResponse(
          `No wallet found.\n\n` +
            `Use /wallet create to generate a new wallet\n` +
            `or /wallet import to import an existing one.`,
        );

      default:
        return new ClientResponse("Unable to retrieve wallet information.");
    }
  }

  formatCreateWallet(result: CreateWalletResult, seedTtlMinutes?: number): ClientResponse {
    switch (result.type) {
      case "created": {
        if (result.seedUrl) {
          const ttl = seedTtlMinutes ?? 5;
          return new ClientResponse(
            `**Wallet Created!**\n\n` +
              this.formatWalletInfo(result.wallet!) +
              `\n\n**Recovery Phrase:**\n` +
              `Your seed phrase is available via secure one-time link.\n\n` +
              `**IMPORTANT:**\n` +
              `- Link expires in ${ttl} minutes\n` +
              `- Link works only ONCE\n` +
              `- Write down the phrase and store offline\n` +
              `- Compatible with Phantom, Solflare, and other Solana wallets`,
            [[{ text: "View Recovery Phrase", url: result.seedUrl }]],
          );
        }

        return new ClientResponse(
          `**Wallet Created!**\n\n` +
            this.formatWalletInfo(result.wallet!) +
            `\n\nDeposit SOL to this address to fund your DCA purchases.\n\n` +
            `**Important:** Use /wallet export to backup your private key.`,
        );
      }

      case "already_exists":
        return new ClientResponse(
          `Wallet already exists.\n\n` +
            this.formatWalletInfo(result.wallet!) +
            `\n\nTo create a new wallet, first delete the existing one with /wallet delete.`,
        );

      case "dev_mode":
        return new ClientResponse(
          `[DEV MODE] Cannot create wallets.\n\n` +
            `Using shared development wallet:\n` +
            this.formatWalletInfo(result.wallet!),
        );

      default:
        return new ClientResponse("Unable to create wallet.");
    }
  }

  formatDeleteWallet(result: DeleteWalletResult): ClientResponse {
    switch (result.type) {
      case "deleted":
        return new ClientResponse(
          `Wallet deleted.\n\n` +
            `Your private key has been removed. ` +
            `Make sure you have backed it up if you need to recover funds.\n\n` +
            `Use /wallet create to generate a new wallet.`,
        );

      case "no_wallet":
        return new ClientResponse(`No wallet to delete.`);

      case "dev_mode":
        return new ClientResponse(`[DEV MODE] Cannot delete shared development wallet.`);

      default:
        return new ClientResponse("Unable to delete wallet.");
    }
  }

  formatExportKey(result: ExportKeyResult, keyTtlMinutes?: number): ClientResponse {
    const ttl = keyTtlMinutes ?? 5;

    switch (result.type) {
      case "success":
        return new ClientResponse(
          `**Export Private Key**\n\n` +
            `Your private key is available via secure one-time link.\n\n` +
            `**IMPORTANT:**\n` +
            `- Link expires in ${ttl} minutes\n` +
            `- Link works only ONCE\n` +
            `- Never share this key with anyone\n` +
            `- Anyone with this key can access your funds\n` +
            `- Store it securely offline`,
          [[{ text: "View Private Key", url: result.keyUrl! }]],
        );

      case "dev_mode":
        return new ClientResponse(
          `**Export Private Key (DEV MODE)**\n\n` +
            `You are using a shared development wallet.\n` +
            `This key is configured via DEV_WALLET_PRIVATE_KEY.\n\n` +
            `Link expires in ${ttl} minutes and works only once.`,
          [[{ text: "View Private Key", url: result.keyUrl! }]],
        );

      case "no_wallet":
        return new ClientResponse(
          `No wallet found.\n\n` +
            `Use /wallet create to generate a wallet first.`,
        );

      default:
        return new ClientResponse("Unable to export private key.");
    }
  }

  formatImportWallet(result: ImportWalletResult): ClientResponse {
    switch (result.type) {
      case "imported":
        return new ClientResponse(
          `**Wallet Imported!**\n\n` +
            this.formatWalletInfo(result.wallet!) +
            `\n\nYour wallet has been successfully imported.\n\n` +
            `**Note:** Your private key is stored securely for DCA operations.`,
        );

      case "already_exists":
        return new ClientResponse(
          `Wallet already exists.\n\n` +
            this.formatWalletInfo(result.wallet!) +
            `\n\nTo import a different wallet, first delete the existing one with /wallet delete.`,
        );

      case "invalid_key":
        return new ClientResponse(
          `**Invalid Key or Mnemonic**\n\n` +
            `${Markdown.escape(result.error || "The provided input is not a valid Solana private key or mnemonic.")}\n\n` +
            `**Supported formats:**\n` +
            `- Recovery phrase: 12 or 24 words\n` +
            `- Private key: base64-encoded (32 or 64 bytes)\n\n` +
            `**Note:** Only Solana wallets are supported. Ethereum and other chain keys will not work.`,
        );

      case "dev_mode":
        return new ClientResponse(
          `[DEV MODE] Cannot import wallets.\n\n` +
            `Using shared development wallet:\n` +
            this.formatWalletInfo(result.wallet!),
        );

      default:
        return new ClientResponse("Unable to import wallet.");
    }
  }

  formatImportLink(url: string, ttlMinutes: number): ClientResponse {
    return new ClientResponse(
      `**Import Wallet**\n\n` +
        `For secure import, use the link below to enter your seed phrase or private key.\n\n` +
        `**Security:**\n` +
        `- Link expires in ${ttlMinutes} minutes\n` +
        `- Link works only ONCE\n` +
        `- Data is sent directly via HTTPS (not through Telegram)`,
      [[{ text: "Open Import Form", url }]],
    );
  }

  formatImportUsage(): ClientResponse {
    return new ClientResponse(
      `**Import Wallet**\n\n` +
        `Use /wallet import to get a secure link for importing your wallet.\n\n` +
        `**Supported formats:**\n` +
        `- Recovery phrase (12 or 24 words) - compatible with Phantom, Solflare\n` +
        `- Base64-encoded private key\n\n` +
        `**Security:**\n` +
        `- Your key is entered via secure web form\n` +
        `- Data is sent directly via HTTPS (not through Telegram)\n` +
        `- The key will be stored securely for DCA operations`,
    );
  }

  formatUnknownSubcommand(): ClientResponse {
    return new ClientResponse(
      `Unknown wallet command.\n\n` +
        `Available commands:\n` +
        `/wallet - Show current wallet\n` +
        `/wallet create - Create new wallet\n` +
        `/wallet import - Import existing wallet\n` +
        `/wallet export - Export private key\n` +
        `/wallet delete - Delete wallet`,
    );
  }
}
