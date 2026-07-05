/**
 * Asset Discovery Repository Implementation
 *
 * Aggregates liquid token balances (RPC) with per-protocol DeFi
 * position fetchers. Fetchers run in parallel; a failing fetcher is
 * isolated and reported via failedSources so one broken protocol
 * source never hides the rest of the wallet.
 */

import type {
  AssetDiscoveryRepository,
  DiscoveredRawAssets,
} from "../../domain/repositories/AssetDiscoveryRepository.js";
import type { DefiPosition, TokenHolding } from "../../domain/models/DiscoveredAssets.js";
import type { WalletAddress } from "../../domain/models/id/index.js";
import { TOKENS } from "../../domain/constants/tokens.js";
import type { SolanaRpcClient } from "../sources/api/SolanaRpcClient.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

/**
 * A source of DeFi positions for one platform (e.g. Kamino).
 */
export interface PositionFetcher {
  /** Stable source id reported in failedSources, e.g. "kamino" */
  id: string;
  fetch(walletAddress: WalletAddress): Promise<DefiPosition[]>;
}

export class AssetDiscoveryRepositoryImpl implements AssetDiscoveryRepository {
  constructor(
    private solanaRpcClient: SolanaRpcClient,
    private positionFetchers: PositionFetcher[],
  ) {}

  async discover(walletAddress: WalletAddress): Promise<DiscoveredRawAssets> {
    // Start everything in parallel; fetcher failures are isolated below,
    // while base token discovery failing fails the whole discovery.
    // allSettled never rejects, so awaiting accounts first cannot leave
    // an unhandled rejection behind.
    const accountsPromise = this.solanaRpcClient.getAllTokenAccounts(walletAddress.value);
    const fetchersPromise = Promise.allSettled(
      this.positionFetchers.map((fetcher) => fetcher.fetch(walletAddress)),
    );
    const { sol, tokens: rawTokens } = await accountsPromise;
    const fetcherResults = await fetchersPromise;

    const tokens: TokenHolding[] = [
      {
        // Native SOL is priced via the WSOL mint (see domain/constants/tokens.ts)
        mint: TOKENS.SOL.mint.value,
        amount: sol,
        decimals: TOKENS.SOL.decimals,
        source: "native",
      },
      ...rawTokens.map(
        (token): TokenHolding => ({
          mint: token.mint,
          amount: token.amount,
          decimals: token.decimals,
          source: token.program,
        }),
      ),
    ];

    const positions: DefiPosition[] = [];
    const failedSources: string[] = [];

    fetcherResults.forEach((result, index) => {
      const fetcher = this.positionFetchers[index];
      if (result.status === "fulfilled") {
        positions.push(...result.value);
      } else {
        failedSources.push(fetcher.id);
        const errorMessage =
          result.reason instanceof Error ? result.reason.message : String(result.reason);
        logger.warn("AssetDiscovery", "Position fetcher failed", {
          fetcher: fetcher.id,
          error: errorMessage,
        });
      }
    });

    return { tokens, positions, failedSources };
  }
}
