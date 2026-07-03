/**
 * Swap validation policy - pure amount/asset validation
 * shared by quote, swap and purchase use cases.
 */
import { AssetSymbol, PORTFOLIO_ASSETS } from "../constants/portfolio.js";
import { MIN_USDC_AMOUNT, MAX_USDC_AMOUNT } from "../constants.js";

export type UsdcAmountValidation =
  | { valid: true }
  | { valid: false; message: string };

export type AssetValidation =
  | { valid: true; asset: AssetSymbol }
  | { valid: false; message: string };

export class SwapValidationPolicy {
  /**
   * Validate a USDC spend amount against the allowed range
   */
  static validateUsdcAmount(amountUsdc: number): UsdcAmountValidation {
    if (isNaN(amountUsdc) || amountUsdc <= 0) {
      return { valid: false, message: "Amount must be a positive number" };
    }
    if (amountUsdc < MIN_USDC_AMOUNT) {
      return { valid: false, message: `Minimum amount is ${MIN_USDC_AMOUNT} USDC` };
    }
    if (amountUsdc > MAX_USDC_AMOUNT) {
      return { valid: false, message: `Maximum amount is ${MAX_USDC_AMOUNT} USDC` };
    }
    return { valid: true };
  }

  /**
   * Validate and normalize a user-supplied asset symbol
   */
  static validateAsset(asset: string): AssetValidation {
    const assetUpper = asset.toUpperCase() as AssetSymbol;
    if (!PORTFOLIO_ASSETS.includes(assetUpper)) {
      return {
        valid: false,
        message: `Unsupported asset: ${asset}. Supported: ${PORTFOLIO_ASSETS.join(", ")}`,
      };
    }
    return { valid: true, asset: assetUpper };
  }
}
