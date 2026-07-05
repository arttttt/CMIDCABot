/**
 * Domain use cases - business operations returning domain objects
 */

export * from "./types.js";

// User
export { InitUserUseCase } from "./InitUserUseCase.js";

// Purchase
export { ExecutePurchaseUseCase } from "./ExecutePurchaseUseCase.js";

// Portfolio
export { GetPortfolioStatusUseCase } from "./GetPortfolioStatusUseCase.js";
export { DetermineAssetToBuyUseCase } from "./DetermineAssetToBuyUseCase.js";

// Asset discovery
export {
  DiscoverAssetsUseCase,
  type DiscoverAssetsResult,
} from "./DiscoverAssetsUseCase.js";

// Wallet
export { GetWalletBalancesUseCase } from "./GetWalletBalancesUseCase.js";
export { GetWalletInfoByAddressUseCase } from "./GetWalletInfoByAddressUseCase.js";
export { GetWalletInfoByPrivateKeyUseCase } from "./GetWalletInfoByPrivateKeyUseCase.js";
export { GetWalletInfoUseCase } from "./GetWalletInfoUseCase.js";
export { CreateWalletUseCase } from "./CreateWalletUseCase.js";
export { ImportWalletUseCase } from "./ImportWalletUseCase.js";
export { DeleteWalletUseCase } from "./DeleteWalletUseCase.js";
export { ExportWalletKeyUseCase } from "./ExportWalletKeyUseCase.js";

// DCA

// Prices
export { GetPricesUseCase } from "./GetPricesUseCase.js";

// Quote
export { GetQuoteUseCase } from "./GetQuoteUseCase.js";

// Swap
export { ExecuteSwapUseCase } from "./ExecuteSwapUseCase.js";
export {
  ResolveConfirmationSessionUseCase,
  type ResolveConfirmationResult,
} from "./ResolveConfirmationSessionUseCase.js";
export {
  CancelConfirmationUseCase,
  type CancelConfirmationResult,
} from "./CancelConfirmationUseCase.js";
export { ConfirmSwapUseCase, type ConfirmSwapResult } from "./ConfirmSwapUseCase.js";
export { ConfirmPurchaseUseCase, type ConfirmPurchaseStep } from "./ConfirmPurchaseUseCase.js";
export {
  PrepareSwapConfirmationUseCase,
  type PrepareSwapConfirmationResult,
  type ConfirmationPreview,
} from "./PrepareSwapConfirmationUseCase.js";
export {
  PreparePurchaseConfirmationUseCase,
  type PreparePurchaseConfirmationResult,
} from "./PreparePurchaseConfirmationUseCase.js";

// Invite
export { GenerateInviteUseCase } from "./GenerateInviteUseCase.js";
export { ActivateInviteUseCase } from "./ActivateInviteUseCase.js";

// Admin
export { DeleteUserDataUseCase } from "./DeleteUserDataUseCase.js";

// Authorization
export { InitializeAuthorizationUseCase } from "./InitializeAuthorizationUseCase.js";
export { AddAuthorizedUserUseCase } from "./AddAuthorizedUserUseCase.js";
export { RemoveAuthorizedUserUseCase } from "./RemoveAuthorizedUserUseCase.js";
export { UpdateUserRoleUseCase } from "./UpdateUserRoleUseCase.js";
export { GetAllAuthorizedUsersUseCase } from "./GetAllAuthorizedUsersUseCase.js";
export { GetUserRoleUseCase } from "./GetUserRoleUseCase.js";

// Market monitor
export { CollectMarketDataUseCase } from "./CollectMarketDataUseCase.js";
export { AnalyzeMarketUseCase } from "./AnalyzeMarketUseCase.js";
export { GetMarketDigestUseCase } from "./GetMarketDigestUseCase.js";
export { GetMarketStatusUseCase } from "./GetMarketStatusUseCase.js";
export { BackfillPriceHistoryUseCase } from "./BackfillPriceHistoryUseCase.js";
