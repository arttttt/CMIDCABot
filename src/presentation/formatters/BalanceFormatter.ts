/**
 * Balance formatter - domain objects to UI response
 */

import { BalanceResult } from "../../domain/usecases/types.js";
import { ClientResponse } from "../protocol/types.js";

export class BalanceFormatter {
  format(result: BalanceResult): ClientResponse {
    switch (result.type) {
      case "no_wallet":
        return new ClientResponse(
          "No wallet connected.\n\n" +
          "Use /wallet set {address} to connect your Solana wallet first.",
        );

      case "fetch_error":
        return new ClientResponse("Failed to fetch balance. Please try again later.");

      case "success": {
        const wallet = result.wallet!;
        const addr = wallet.address.value;
        const truncated = `${addr.slice(0, 8)}...${addr.slice(-8)}`;
        return new ClientResponse(
          `Wallet: ${truncated}\n\n` +
          `SOL Balance: ${wallet.balance!.toFixed(4)} SOL`,
        );
      }

      default:
        return new ClientResponse("Unable to retrieve balance.");
    }
  }
}
