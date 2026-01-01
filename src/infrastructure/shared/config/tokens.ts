/**
 * Centralized token configuration
 * Single source of truth for all token-related constants
 */

import { tokenMint, type TokenMint } from "../../../types/id/index.js";

export interface TokenConfig {
  mint: TokenMint;
  decimals: number;
}

/**
 * Token configurations for supported assets
 *
 * IMPORTANT: SOL vs WSOL clarification
 * ------------------------------------
 * The SOL entry stores the WSOL (Wrapped SOL) mint address, also known as NATIVE_MINT.
 * This is intentional because:
 *
 * 1. DEX APIs (Jupiter, Raydium, Orca) require the WSOL mint for swap routing
 * 2. Price APIs (Jupiter Price API) use the WSOL mint to identify SOL
 * 3. Jupiter Swap API automatically handles wrap/unwrap when wrapAndUnwrapSol=true (default)
 *
 * Native SOL (lamports) vs WSOL (SPL token):
 * - Native SOL: Stored in account.balance, used for transaction fees
 * - WSOL: SPL token with this mint, needed for DEX swaps
 *
 * In our code:
 * - SolanaRpcClient.getBalance() returns NATIVE SOL balance (lamports)
 * - TOKEN_MINTS.SOL is used only for Jupiter API calls (prices, quotes, swaps)
 * - Jupiter handles wrap/unwrap automatically — we don't manage WSOL accounts manually
 *
 * See: https://spl.solana.com/token#wrapping-sol
 */
export const TOKENS = {
  SOL: {
    mint: tokenMint("So11111111111111111111111111111111111111112"),
    decimals: 9,
  },
  USDC: {
    mint: tokenMint("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
    decimals: 6,
  },
  BTC: {
    mint: tokenMint("cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij"),
    decimals: 8,
  },
  ETH: {
    mint: tokenMint("7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs"),
    decimals: 8,
  },
} as const satisfies Record<string, TokenConfig>;

/**
 * Token mint addresses for direct access
 */
export const TOKEN_MINTS = {
  SOL: TOKENS.SOL.mint,
  USDC: TOKENS.USDC.mint,
  BTC: TOKENS.BTC.mint,
  ETH: TOKENS.ETH.mint,
} as const;

/**
 * Token decimal places for direct access
 *
 * Solana tokens store amounts as integers in smallest units:
 *   actual_amount = raw_amount / 10^decimals
 *
 * Examples:
 *   1 SOL = 1,000,000,000 lamports (9 decimals)
 *   1 USDC = 1,000,000 units (6 decimals)
 *   1 BTC (cbBTC) = 100,000,000 satoshis (8 decimals)
 */
export const TOKEN_DECIMALS = {
  SOL: TOKENS.SOL.decimals,
  USDC: TOKENS.USDC.decimals,
  BTC: TOKENS.BTC.decimals,
  ETH: TOKENS.ETH.decimals,
} as const;
