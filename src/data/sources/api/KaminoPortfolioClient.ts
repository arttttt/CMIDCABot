/**
 * Kamino Portfolio Client - fetches a wallet's Kamino positions from
 * the public Kamino API (no key required).
 *
 * Endpoint: GET https://api.kamino.finance/portfolio/{pubkey}
 * Schema: https://api.kamino.finance/documentation/ (OpenAPI at /openapi/json)
 * All numeric fields are decimal strings.
 */

import { logger } from "../../../infrastructure/shared/logging/index.js";

const KAMINO_API = "https://api.kamino.finance";
const REQUEST_TIMEOUT_MS = 20000;

/**
 * A token leg of a position (deposit, borrow or pool side)
 */
export interface KaminoTokenAmount {
  mint?: string;
  symbol: string;
  /** Human units, decimal string */
  amount: string;
  /** USD value, decimal string */
  value: string;
}

/**
 * Lending/multiply/leverage obligation position
 */
export interface KaminoObligationPosition {
  tag: string;
  /** Net USD value (deposits minus borrows), decimal string */
  netValue: string;
  leverage: string;
  deposits: KaminoTokenAmount[];
  borrows: KaminoTokenAmount[];
}

/**
 * Liquidity vault (kToken) position
 */
export interface KaminoLiquidityPosition {
  netValue: string;
  tokenA: KaminoTokenAmount;
  tokenB: KaminoTokenAmount;
}

/**
 * Earn / private credit vault position
 */
export interface KaminoVaultPosition {
  tokenMint?: string;
  symbol: string;
  name: string;
  netValue: string;
  amount: string;
}

/**
 * Staking position (staked KMNO etc.)
 */
export interface KaminoStakingPosition {
  mint?: string;
  symbol: string;
  amount: string;
  value: string;
}

export interface KaminoPortfolioResponse {
  lending: KaminoObligationPosition[];
  multiply: KaminoObligationPosition[];
  leverage: KaminoObligationPosition[];
  liquidity: KaminoLiquidityPosition[];
  earn: KaminoVaultPosition[];
  privateCredit: KaminoVaultPosition[];
  staking: KaminoStakingPosition[];
}

export class KaminoPortfolioClient {
  constructor(private baseUrl: string = KAMINO_API) {}

  /**
   * Fetch all Kamino positions of a wallet across products
   * (lending, multiply, leverage, liquidity, earn, private credit, staking).
   */
  async getPortfolio(walletAddress: string): Promise<KaminoPortfolioResponse> {
    const url = `${this.baseUrl}/portfolio/${walletAddress}`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      logger.error("KaminoClient", "Kamino API error", {
        status: response.status,
        statusText: response.statusText,
      });
      throw new Error(`Kamino portfolio API error: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as KaminoPortfolioResponse;
  }
}
