import {
    InitUserUseCase,
    GetWalletInfoUseCase,
    CreateWalletUseCase,
    ImportWalletUseCase,
    DeleteWalletUseCase,
    ExportWalletKeyUseCase,
    GetPortfolioStatusUseCase,
    GetPricesUseCase,
    GetMarketStatusUseCase,
    GetQuoteUseCase,
    PreparePurchaseConfirmationUseCase,
    PrepareSwapConfirmationUseCase,
    ConfirmPurchaseUseCase,
    ConfirmSwapUseCase,
    CancelConfirmationUseCase,
    GenerateInviteUseCase,
    ActivateInviteUseCase,
    DeleteUserDataUseCase,
    AddAuthorizedUserUseCase,
    GetAllAuthorizedUsersUseCase,
    UpdateUserRoleUseCase,
} from "../../domain/usecases/index.js";

import { UserResolver } from "../telegram/UserResolver.js";
import type { ImportSessionRepository } from "../../domain/repositories/index.js";

import {
    WalletFormatter,
    PortfolioFormatter,
    PurchaseFormatter,
    PriceFormatter,
    QuoteFormatter,
    SwapFormatter,
    AdminFormatter,
    InviteFormatter,
    ProgressFormatter,
    ConfirmationFormatter,
    HelpFormatter,
    MarketFormatter,
} from "../formatters/index.js";

import { CommandRegistry } from "./types.js";

// ============================================================
// Dependencies types
// ============================================================

export interface WalletCommandDeps {
    getWalletInfo: GetWalletInfoUseCase;
    createWallet: CreateWalletUseCase;
    importWallet: ImportWalletUseCase;
    deleteWallet: DeleteWalletUseCase;
    exportWalletKey: ExportWalletKeyUseCase;
    formatter: WalletFormatter;
    importSessionStore: ImportSessionRepository;
}

export interface PortfolioCommandDeps {
    getPortfolioStatus: GetPortfolioStatusUseCase;
    portfolioFormatter: PortfolioFormatter;
    purchaseFormatter: PurchaseFormatter;
    progressFormatter: ProgressFormatter;
    // Confirmation flow dependencies
    preparePurchaseConfirmation: PreparePurchaseConfirmationUseCase;
    confirmPurchase: ConfirmPurchaseUseCase;
    cancelConfirmation: CancelConfirmationUseCase;
    confirmationFormatter: ConfirmationFormatter;
}

export interface PricesCommandDeps {
    getPrices: GetPricesUseCase;
    formatter: PriceFormatter;
}

export interface MarketCommandDeps {
    getMarketStatus: GetMarketStatusUseCase;
    formatter: MarketFormatter;
}

export interface SwapCommandDeps {
    getQuote: GetQuoteUseCase;
    quoteFormatter: QuoteFormatter;
    swapFormatter: SwapFormatter;
    // Confirmation flow dependencies
    prepareSwapConfirmation: PrepareSwapConfirmationUseCase;
    confirmSwap: ConfirmSwapUseCase;
    cancelConfirmation: CancelConfirmationUseCase;
    confirmationFormatter: ConfirmationFormatter;
}

export interface AdminCommandDeps {
    addAuthorizedUser: AddAuthorizedUserUseCase;
    getAllAuthorizedUsers: GetAllAuthorizedUsersUseCase;
    updateUserRole: UpdateUserRoleUseCase;
    formatter: AdminFormatter;
    userResolver: UserResolver;
    deleteUserData: DeleteUserDataUseCase;
    version: string;
    generateInvite?: GenerateInviteUseCase;
    inviteFormatter?: InviteFormatter;
}

export interface StartCommandDeps {
    initUser: InitUserUseCase;
    activateInvite?: ActivateInviteUseCase;
    inviteFormatter?: InviteFormatter;
}

export interface VersionCommandDeps {
    version: string;
    formatter: AdminFormatter;
}

/**
 * External dependencies for help command (passed from DI container)
 * getRegistry is added by registry itself to break circular dependency
 */
export interface HelpCommandExternalDeps {
    helpFormatter: HelpFormatter;
}

export interface HelpCommandDeps extends HelpCommandExternalDeps {
    getRegistry: () => CommandRegistry;
}
