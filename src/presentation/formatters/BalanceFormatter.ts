/**
 * Balance formatter - domain objects to UI response
 */

import { BalanceResult } from "../../domain/usecases/types.js";
import { ClientResponse } from "../protocol/types.js";

export class BalanceFormatter {
  format(result: BalanceResult): ClientResponse {
    switch (result.type) {
      case "no_wallet":
        return {
          text:
            "No wallet connected.\n\n" +
            "Use /wallet set {address} to connect your Solana wallet first.",
        };

      case "fetch_error":
        return {
          text: "Failed to fetch balance. Please try again later.",
        };

      case "success": {
        const wallet = result.wallet!;
        const truncated = `${wallet.address.slice(0, 8)}...${wallet.address.slice(-8)}`;
        return {
          text:
            `Wallet: ${truncated}\n\n` +
            `SOL Balance: ${wallet.balance!.toFixed(4)} SOL`,
        };
      }

      default:
        return { text: "Unable to retrieve balance." };
    }
  }
}
