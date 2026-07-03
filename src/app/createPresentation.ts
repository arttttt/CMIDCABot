/**
 * Presentation composition - formatters, command registries, gateway
 */

import type { Config } from "../infrastructure/shared/config/envSchema.js";
import type { OwnerConfig } from "../domain/models/OwnerConfig.js";
import type { Storage } from "./createStorage.js";
import type { UseCases } from "./createUseCases.js";
import { TelegramUserResolver } from "../presentation/telegram/UserResolver.js";
import { GatewayFactory } from "../presentation/protocol/gateway/index.js";
import {
  DevCommandRegistry,
  ProdCommandRegistry,
  type DevCommandRegistryDeps,
  type ProdCommandRegistryDeps,
  type CommandRegistry,
} from "../presentation/commands/index.js";
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
} from "../presentation/formatters/index.js";

export interface PresentationDeps {
  config: Config;
  version: string;
  ownerConfig: OwnerConfig;
  storage: Storage;
  useCases: UseCases;
}

export interface Presentation {
  userResolver: TelegramUserResolver;
  marketFormatter: MarketFormatter;
  createRegistryAndGateway(botUsername?: string): {
    registry: CommandRegistry;
    gateway: ReturnType<typeof GatewayFactory.create>;
  };
}

export function createPresentation(deps: PresentationDeps): Presentation {
  const { config, version, ownerConfig, storage, useCases } = deps;

  // User resolver is connected to the bot API later (setApi)
  const userResolver = new TelegramUserResolver();

  const walletFormatter = new WalletFormatter();
  const portfolioFormatter = new PortfolioFormatter();
  const purchaseFormatter = new PurchaseFormatter();
  const priceFormatter = new PriceFormatter();
  const quoteFormatter = new QuoteFormatter();
  const swapFormatter = new SwapFormatter();
  const adminFormatter = new AdminFormatter();
  const progressFormatter = new ProgressFormatter();
  const confirmationFormatter = new ConfirmationFormatter();
  const helpFormatter = new HelpFormatter();
  const marketFormatter = new MarketFormatter();

  function createRegistryAndGateway(botUsername?: string) {
    // Invite links need the bot username, available only after getMe()
    const inviteFormatter = botUsername ? new InviteFormatter(botUsername) : undefined;

    const startDeps = {
      initUser: useCases.initUser,
      activateInvite: inviteFormatter ? useCases.activateInvite : undefined,
      inviteFormatter,
    };

    const adminDeps = {
      addAuthorizedUser: useCases.addAuthorizedUser,
      getAllAuthorizedUsers: useCases.getAllAuthorizedUsers,
      updateUserRole: useCases.updateUserRole,
      formatter: adminFormatter,
      userResolver,
      deleteUserData: useCases.deleteUserData,
      version,
      generateInvite: inviteFormatter ? useCases.generateInvite : undefined,
      inviteFormatter,
    };

    const versionDeps = {
      version,
      formatter: adminFormatter,
    };

    // Note: getRegistry is added in registry constructor to break circular dependency
    const helpDeps = {
      helpFormatter,
    };

    const walletDeps = {
      getWalletInfo: useCases.getWalletInfo,
      createWallet: useCases.createWallet,
      importWallet: useCases.importWallet,
      deleteWallet: useCases.deleteWallet,
      exportWalletKey: useCases.exportWalletKey,
      formatter: walletFormatter,
      importSessionStore: storage.importSessionStore,
    };

    const portfolioDeps = {
      getPortfolioStatus: useCases.getPortfolioStatus,
      portfolioFormatter,
      purchaseFormatter,
      progressFormatter,
      preparePurchaseConfirmation: useCases.preparePurchaseConfirmation,
      confirmPurchase: useCases.confirmPurchase,
      cancelConfirmation: useCases.cancelConfirmation,
      confirmationFormatter,
    };

    const marketDeps = {
      getMarketStatus: useCases.getMarketStatus,
      formatter: marketFormatter,
    };

    let registry: CommandRegistry;

    if (config.isDev) {
      const devDeps: DevCommandRegistryDeps = {
        start: startDeps,
        wallet: walletDeps,
        portfolio: portfolioDeps,
        prices: {
          getPrices: useCases.getPrices,
          formatter: priceFormatter,
        },
        market: marketDeps,
        swap: {
          getQuote: useCases.getQuote,
          quoteFormatter,
          swapFormatter,
          prepareSwapConfirmation: useCases.prepareSwapConfirmation,
          confirmSwap: useCases.confirmSwap,
          cancelConfirmation: useCases.cancelConfirmation,
          confirmationFormatter,
        },
        admin: adminDeps,
        version: versionDeps,
        help: helpDeps,
      };
      registry = new DevCommandRegistry(devDeps);
    } else {
      const prodDeps: ProdCommandRegistryDeps = {
        start: startDeps,
        wallet: walletDeps,
        portfolio: portfolioDeps,
        market: marketDeps,
        admin: adminDeps,
        version: versionDeps,
        help: helpDeps,
      };
      registry = new ProdCommandRegistry(prodDeps);
    }

    const gateway = GatewayFactory.create({
      getUserRole: useCases.getUserRole,
      commandRegistry: registry,
      rateLimitRepository: storage.rateLimitRepository,
      ownerConfig,
    });

    return { registry, gateway };
  }

  return { userResolver, marketFormatter, createRegistryAndGateway };
}
