/**
 * PurchaseStep - Discriminated union for purchase operation progress
 *
 * Purchase operation consists of:
 * 1. Asset selection based on portfolio allocation
 * 2. Swap execution (delegated to SwapStep)
 * 3. Completed with result
 */

import type { SwapStep } from "./SwapStep.js";
import type { PurchaseResult } from "../usecases/types.js";
import type { AllocationInfo } from "./PortfolioTypes.js";

/**
 * Purchase operation steps (including completed)
 */
export type PurchaseStep =
  | { step: "selecting_asset" }
  | { step: "asset_selected"; selection: AllocationInfo }
  | { step: "swap"; swapStep: SwapStep }
  | { step: "completed"; result: PurchaseResult };

/**
 * Helper constructors for purchase steps
 */
export const PurchaseSteps = {
  selectingAsset(): PurchaseStep {
    return { step: "selecting_asset" };
  },

  assetSelected(selection: AllocationInfo): PurchaseStep {
    return { step: "asset_selected", selection };
  },

  swap(swapStep: SwapStep): PurchaseStep {
    return { step: "swap", swapStep };
  },

  completed(result: PurchaseResult): PurchaseStep {
    return { step: "completed", result };
  },
} as const;
