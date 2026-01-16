import {
    InitUserUseCase,
    GetWalletInfoUseCase,
    CreateWalletUseCase,
    ImportWalletUseCase,
    DeleteWalletUseCase,
    ExportWalletKeyUseCase,
    StartDcaUseCase,
    StopDcaUseCase,
    GetDcaStatusUseCase,
    GetPortfolioStatusUseCase,
    ExecutePurchaseUseCase,
    DetermineAssetToBuyUseCase,
    GetPricesUseCase,
    GetQuoteUseCase,
    ExecuteSwapUseCase,
    GenerateInviteUseCase,
    ActivateInviteUseCase,
    DeleteUserDataUseCase,
    AddAuthorizedUserUseCase,
    GetAllAuthorizedUsersUseCase,
    UpdateUserRoleUseCase,
} from "../../domain/usecases/index.js";

import { UserResolver } from "../telegram/UserResolver.js";
import type {
    ImportSessionRepository,
    ConfirmationRepository,
    SwapRepository,
} from "../../domain/repositories/index.js";

import {
    DcaWalletFormatter,
    DcaFormatter,
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
    formatter: DcaWalletFormatter;
    importSessionStore: ImportSessionRepository;
}

export interface DcaCommandDeps {
    startDca: StartDcaUseCase;
    stopDca: StopDcaUseCase;
    getDcaStatus: GetDcaStatusUseCase;
    formatter: DcaFormatter;
}

export interface PortfolioCommandDeps {
    getPortfolioStatus: GetPortfolioStatusUseCase | undefined;
    executePurchase: ExecutePurchaseUseCase | undefined;
    determineAssetToBuy: DetermineAssetToBuyUseCase | undefined;
    portfolioFormatter: PortfolioFormatter;
    purchaseFormatter: PurchaseFormatter;
    progressFormatter: ProgressFormatter;
    // Confirmation flow dependencies
    confirmationRepository: ConfirmationRepository | undefined;
    confirmationFormatter: ConfirmationFormatter | undefined;
    swapRepository: SwapRepository | undefined;
}

export interface PricesCommandDeps {
    getPrices: GetPricesUseCase;
    formatter: PriceFormatter;
}

export interface SwapCommandDeps {
    getQuote: GetQuoteUseCase;
    executeSwap: ExecuteSwapUseCase;
    quoteFormatter: QuoteFormatter;
    swapFormatter: SwapFormatter;
    progressFormatter: ProgressFormatter;
    // Confirmation flow dependencies
    confirmationRepository: ConfirmationRepository | undefined;
    confirmationFormatter: ConfirmationFormatter | undefined;
    swapRepository: SwapRepository | undefined;
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
