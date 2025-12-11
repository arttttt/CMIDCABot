// Target allocations for Healthy Crypto Index
export const TARGET_ALLOCATIONS = {
  BTC: 0.4, // 40%
  ETH: 0.3, // 30%
  SOL: 0.3, // 30%
} as const;

export type AssetSymbol = keyof typeof TARGET_ALLOCATIONS;

export interface AssetBalance {
  symbol: AssetSymbol;
  balance: number;
  valueInUsdc: number;
  currentAllocation: number;
  targetAllocation: number;
  deviation: number;
}

export interface Portfolio {
  assets: AssetBalance[];
  totalValueInUsdc: number;
  updatedAt: Date;
}
