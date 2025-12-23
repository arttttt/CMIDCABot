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

// Wallet
export { WalletInfoHelper } from "./helpers/WalletInfoHelper.js";
export { ShowWalletUseCase } from "./ShowWalletUseCase.js";
export { CreateWalletUseCase } from "./CreateWalletUseCase.js";
export { ImportWalletUseCase } from "./ImportWalletUseCase.js";
export { DeleteWalletUseCase } from "./DeleteWalletUseCase.js";
export { ExportWalletKeyUseCase } from "./ExportWalletKeyUseCase.js";

// DCA
export { StartDcaUseCase } from "./StartDcaUseCase.js";
export { StopDcaUseCase } from "./StopDcaUseCase.js";
export { GetDcaStatusUseCase } from "./GetDcaStatusUseCase.js";

// Prices
export { GetPricesUseCase } from "./GetPricesUseCase.js";

// Quote
export { GetQuoteUseCase } from "./GetQuoteUseCase.js";

// Simulate
export { SimulateSwapUseCase } from "./SimulateSwapUseCase.js";

// Swap
export { ExecuteSwapUseCase } from "./ExecuteSwapUseCase.js";

// Invite
export { GenerateInviteUseCase, type GenerateInviteResult } from "./GenerateInviteUseCase.js";
export { ActivateInviteUseCase, type ActivateInviteResult } from "./ActivateInviteUseCase.js";

// Admin
export { DeleteUserDataUseCase } from "./DeleteUserDataUseCase.js";

// Authorization
export { InitializeAuthorizationUseCase } from "./InitializeAuthorizationUseCase.js";
export { AddAuthorizedUserUseCase, type AddAuthorizedUserResult } from "./AddAuthorizedUserUseCase.js";
export { RemoveAuthorizedUserUseCase, type RemoveAuthorizedUserResult } from "./RemoveAuthorizedUserUseCase.js";
export { UpdateUserRoleUseCase, type UpdateUserRoleResult } from "./UpdateUserRoleUseCase.js";
export { GetAllAuthorizedUsersUseCase, type GetAllAuthorizedUsersResult } from "./GetAllAuthorizedUsersUseCase.js";

// Mock Purchase (dev-only)
export { ExecuteMockPurchaseUseCase, type MockPurchaseResult } from "./ExecuteMockPurchaseUseCase.js";
export { ResetPortfolioUseCase, type ResetPortfolioResult } from "./ResetPortfolioUseCase.js";
export { ExecuteBatchDcaUseCase, type BatchDcaResult } from "./ExecuteBatchDcaUseCase.js";

// Helpers
export * from "./helpers/index.js";
