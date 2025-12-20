/**
 * PurchaseStep - Discriminated union for purchase operation progress
 *
 * Purchase operation consists of:
 * 1. Asset selection based on portfolio allocation
 * 2. Swap execution (delegated to SwapStep)
 */

import type { AssetSymbol } from "../../types/portfolio.js";
import type { SwapStep } from "./SwapStep.js";

/**
 * Asset selection information for display
 */
export interface AssetSelectionInfo {
  asset: AssetSymbol;
  currentAllocation: number;
  targetAllocation: number;
  deviation: number;
}

/**
 * Purchase operation steps
 */
export type PurchaseStep =
  | { step: "selecting_asset" }
  | { step: "asset_selected"; selection: AssetSelectionInfo }
  | { step: "swap"; swapStep: SwapStep };

/**
 * Helper constructors for purchase steps
 */
export const PurchaseSteps = {
  selectingAsset(): PurchaseStep {
    return { step: "selecting_asset" };
  },

  assetSelected(selection: AssetSelectionInfo): PurchaseStep {
    return { step: "asset_selected", selection };
  },

  swap(swapStep: SwapStep): PurchaseStep {
    return { step: "swap", swapStep };
  },
} as const;
