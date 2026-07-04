/**
 * Use case composition - instantiates all domain use cases from repositories
 */

import type { OwnerConfig } from "../domain/models/OwnerConfig.js";
import type { Storage } from "./createStorage.js";
import type { Blockchain } from "./createBlockchain.js";
import {
  InitUserUseCase,
  ExecutePurchaseUseCase,
  GetPortfolioStatusUseCase,
  DiscoverAssetsUseCase,
  DetermineAssetToBuyUseCase,
  GetWalletBalancesUseCase,
  GetWalletInfoByAddressUseCase,
  GetWalletInfoByPrivateKeyUseCase,
  GetWalletInfoUseCase,
  CreateWalletUseCase,
  ImportWalletUseCase,
  DeleteWalletUseCase,
  ExportWalletKeyUseCase,
  GetPricesUseCase,
  GetQuoteUseCase,
  ExecuteSwapUseCase,
  GenerateInviteUseCase,
  ActivateInviteUseCase,
  DeleteUserDataUseCase,
  InitializeAuthorizationUseCase,
  AddAuthorizedUserUseCase,
  RemoveAuthorizedUserUseCase,
  GetAllAuthorizedUsersUseCase,
  UpdateUserRoleUseCase,
  GetUserRoleUseCase,
  GetMarketStatusUseCase,
  ResolveConfirmationSessionUseCase,
  CancelConfirmationUseCase,
  ConfirmSwapUseCase,
  ConfirmPurchaseUseCase,
  PrepareSwapConfirmationUseCase,
  PreparePurchaseConfirmationUseCase,
} from "../domain/usecases/index.js";

export interface UseCases {
  initializeAuthorization: InitializeAuthorizationUseCase;
  getUserRole: GetUserRoleUseCase;
  addAuthorizedUser: AddAuthorizedUserUseCase;
  getAllAuthorizedUsers: GetAllAuthorizedUsersUseCase;
  updateUserRole: UpdateUserRoleUseCase;
  deleteUserData: DeleteUserDataUseCase;
  generateInvite: GenerateInviteUseCase;
  activateInvite: ActivateInviteUseCase;
  initUser: InitUserUseCase;
  getWalletInfo: GetWalletInfoUseCase;
  createWallet: CreateWalletUseCase;
  importWallet: ImportWalletUseCase;
  deleteWallet: DeleteWalletUseCase;
  exportWalletKey: ExportWalletKeyUseCase;
  getPrices: GetPricesUseCase;
  getQuote: GetQuoteUseCase;
  executeSwap: ExecuteSwapUseCase;
  determineAssetToBuy: DetermineAssetToBuyUseCase;
  executePurchase: ExecutePurchaseUseCase;
  getPortfolioStatus: GetPortfolioStatusUseCase;
  discoverAssets: DiscoverAssetsUseCase;
  getMarketStatus: GetMarketStatusUseCase;
  cancelConfirmation: CancelConfirmationUseCase;
  confirmSwap: ConfirmSwapUseCase;
  confirmPurchase: ConfirmPurchaseUseCase;
  prepareSwapConfirmation: PrepareSwapConfirmationUseCase;
  preparePurchaseConfirmation: PreparePurchaseConfirmationUseCase;
}

export function createUseCases(
  storage: Storage,
  blockchain: Blockchain,
  ownerConfig: OwnerConfig,
): UseCases {
  const {
    userRepository,
    transactionRepository,
    authRepository,
    inviteTokenRepository,
    priceHistoryRepository,
    secretStore,
    operationLockRepository,
    confirmationRepository,
  } = storage;
  const {
    blockchainRepository,
    balanceRepository,
    priceRepository,
    swapRepository,
    assetDiscoveryRepository,
  } = blockchain;

  // Authorization
  const initializeAuthorization = new InitializeAuthorizationUseCase(authRepository, ownerConfig);
  const getUserRole = new GetUserRoleUseCase(authRepository, ownerConfig);
  const addAuthorizedUser = new AddAuthorizedUserUseCase(authRepository, getUserRole);
  const removeAuthorizedUser = new RemoveAuthorizedUserUseCase(authRepository, getUserRole, ownerConfig);
  const getAllAuthorizedUsers = new GetAllAuthorizedUsersUseCase(authRepository);
  const updateUserRole = new UpdateUserRoleUseCase(authRepository, getUserRole, ownerConfig);
  const deleteUserData = new DeleteUserDataUseCase(
    removeAuthorizedUser,
    userRepository,
    transactionRepository,
  );

  // Invites
  const generateInvite = new GenerateInviteUseCase(inviteTokenRepository, authRepository);
  const activateInvite = new ActivateInviteUseCase(inviteTokenRepository, authRepository);

  // Wallet
  const getWalletBalances = new GetWalletBalancesUseCase(balanceRepository);
  const getWalletInfoByPrivateKey = new GetWalletInfoByPrivateKeyUseCase(
    blockchainRepository,
    getWalletBalances,
  );
  const getWalletInfoByAddress = new GetWalletInfoByAddressUseCase(getWalletBalances);
  const initUser = new InitUserUseCase(userRepository);
  const getWalletInfo = new GetWalletInfoUseCase(userRepository, getWalletInfoByAddress);
  const createWallet = new CreateWalletUseCase(
    userRepository,
    blockchainRepository,
    getWalletInfoByAddress,
    getWalletInfoByPrivateKey,
    operationLockRepository,
    secretStore,
  );
  const importWallet = new ImportWalletUseCase(
    userRepository,
    blockchainRepository,
    getWalletInfoByAddress,
    getWalletInfoByPrivateKey,
    operationLockRepository,
  );
  const deleteWallet = new DeleteWalletUseCase(userRepository);
  const exportWalletKey = new ExportWalletKeyUseCase(userRepository, secretStore);

  // Prices and swaps
  const getPrices = new GetPricesUseCase(priceRepository);
  const getQuote = new GetQuoteUseCase(swapRepository);
  const executeSwap = new ExecuteSwapUseCase(
    swapRepository,
    blockchainRepository,
    userRepository,
    transactionRepository,
    balanceRepository,
    operationLockRepository,
  );

  // Portfolio
  const determineAssetToBuy = new DetermineAssetToBuyUseCase(userRepository, balanceRepository, priceRepository);
  const executePurchase = new ExecutePurchaseUseCase(executeSwap, determineAssetToBuy, operationLockRepository);
  const getPortfolioStatus = new GetPortfolioStatusUseCase(userRepository, balanceRepository, priceRepository);
  const discoverAssets = new DiscoverAssetsUseCase(
    userRepository,
    assetDiscoveryRepository,
    priceRepository,
  );

  // Confirmation flow (preview -> confirm/cancel)
  const resolveConfirmationSession = new ResolveConfirmationSessionUseCase(
    confirmationRepository,
    swapRepository,
  );
  const cancelConfirmation = new CancelConfirmationUseCase(confirmationRepository);
  const confirmSwap = new ConfirmSwapUseCase(resolveConfirmationSession, executeSwap);
  const confirmPurchase = new ConfirmPurchaseUseCase(resolveConfirmationSession, executePurchase);
  const prepareSwapConfirmation = new PrepareSwapConfirmationUseCase(
    confirmationRepository,
    swapRepository,
  );
  const preparePurchaseConfirmation = new PreparePurchaseConfirmationUseCase(
    confirmationRepository,
    swapRepository,
    determineAssetToBuy,
  );

  // Market
  const getMarketStatus = new GetMarketStatusUseCase(priceRepository, priceHistoryRepository);

  return {
    initializeAuthorization,
    getUserRole,
    addAuthorizedUser,
    getAllAuthorizedUsers,
    updateUserRole,
    deleteUserData,
    generateInvite,
    activateInvite,
    initUser,
    getWalletInfo,
    createWallet,
    importWallet,
    deleteWallet,
    exportWalletKey,
    getPrices,
    getQuote,
    executeSwap,
    determineAssetToBuy,
    executePurchase,
    getPortfolioStatus,
    discoverAssets,
    getMarketStatus,
    cancelConfirmation,
    confirmSwap,
    confirmPurchase,
    prepareSwapConfirmation,
    preparePurchaseConfirmation,
  };
}
