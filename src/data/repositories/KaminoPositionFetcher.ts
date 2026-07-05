/**
 * Kamino position fetcher - maps Kamino portfolio API data to domain
 * DeFi positions for asset discovery.
 */

import type { DefiPosition, DefiPositionAsset } from "../../domain/models/DiscoveredAssets.js";
import type { WalletAddress } from "../../domain/models/id/index.js";
import type { PositionFetcher } from "./AssetDiscoveryRepositoryImpl.js";
import type {
  KaminoLiquidityPosition,
  KaminoObligationPosition,
  KaminoPortfolioClient,
  KaminoStakingPosition,
  KaminoTokenAmount,
  KaminoVaultPosition,
} from "../sources/api/KaminoPortfolioClient.js";

const PLATFORM = "kamino";

export class KaminoPositionFetcher implements PositionFetcher {
  public readonly id = PLATFORM;

  constructor(private client: KaminoPortfolioClient) {}

  async fetch(walletAddress: WalletAddress): Promise<DefiPosition[]> {
    const portfolio = await this.client.getPortfolio(walletAddress.value);

    return [
      ...(portfolio.lending ?? []).map((position) => this.mapObligation(position, "Lending")),
      ...(portfolio.multiply ?? []).map((position) =>
        this.mapObligation(position, this.leveredLabel("Multiply", position.leverage)),
      ),
      ...(portfolio.leverage ?? []).map((position) =>
        this.mapObligation(position, this.leveredLabel("Leverage", position.leverage)),
      ),
      ...(portfolio.liquidity ?? []).map((position) => this.mapLiquidity(position)),
      ...(portfolio.earn ?? []).map((position) => this.mapVault(position, "Earn")),
      ...(portfolio.privateCredit ?? []).map((position) =>
        this.mapVault(position, "Private credit"),
      ),
      ...(portfolio.staking ?? []).map((position) => this.mapStaking(position)),
    ];
  }

  private mapObligation(position: KaminoObligationPosition, label: string): DefiPosition {
    return {
      platform: PLATFORM,
      label,
      kind: "supplied",
      assets: [
        ...position.deposits.map((deposit) => this.mapAsset(deposit, "supplied")),
        ...position.borrows.map((borrow) => this.mapAsset(borrow, "borrowed")),
      ],
      usdValue: Number(position.netValue),
    };
  }

  private mapLiquidity(position: KaminoLiquidityPosition): DefiPosition {
    return {
      platform: PLATFORM,
      label: "Liquidity vault",
      kind: "liquidity",
      assets: [
        this.mapAsset(position.tokenA, "supplied"),
        this.mapAsset(position.tokenB, "supplied"),
      ],
      usdValue: Number(position.netValue),
    };
  }

  private mapVault(position: KaminoVaultPosition, label: string): DefiPosition {
    return {
      platform: PLATFORM,
      label: `${label} ${position.name}`,
      kind: "supplied",
      assets: [
        {
          symbol: position.symbol,
          mint: position.tokenMint,
          amount: Number(position.amount),
          usdValue: Number(position.netValue),
        },
      ],
      usdValue: Number(position.netValue),
    };
  }

  private mapStaking(position: KaminoStakingPosition): DefiPosition {
    return {
      platform: PLATFORM,
      label: "Staking",
      kind: "staked",
      assets: [
        {
          symbol: position.symbol,
          mint: position.mint,
          amount: Number(position.amount),
          usdValue: Number(position.value),
        },
      ],
      usdValue: Number(position.value),
    };
  }

  private mapAsset(
    token: KaminoTokenAmount,
    role: DefiPositionAsset["role"],
  ): DefiPositionAsset {
    return {
      symbol: token.symbol,
      mint: token.mint,
      amount: Number(token.amount),
      usdValue: Number(token.value),
      role,
    };
  }

  private leveredLabel(base: string, leverage: string): string {
    const value = Number(leverage);
    return Number.isFinite(value) && value > 0 ? `${base} ${value.toFixed(1)}x` : base;
  }
}
