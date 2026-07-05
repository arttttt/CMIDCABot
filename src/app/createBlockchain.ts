/**
 * Blockchain composition - Solana RPC and Jupiter clients behind domain ports
 */

import type { Config } from "../infrastructure/shared/config/envSchema.js";
import type {
  BlockchainRepository,
  BalanceRepository,
  PriceRepository,
  SwapRepository,
  AssetDiscoveryRepository,
} from "../domain/repositories/index.js";
import type { KeyEncryptionService } from "../infrastructure/internal/crypto/index.js";
import { SolanaRpcClient } from "../data/sources/api/SolanaRpcClient.js";
import { WalletKeyService } from "../data/sources/crypto/WalletKeyService.js";
import { JupiterPriceClient } from "../data/sources/api/JupiterPriceClient.js";
import { JupiterSwapClient } from "../data/sources/api/JupiterSwapClient.js";
import { SolanaBlockchainRepository } from "../data/repositories/SolanaBlockchainRepository.js";
import { CachedBalanceRepository } from "../data/repositories/memory/CachedBalanceRepository.js";
import { AssetDiscoveryRepositoryImpl } from "../data/repositories/AssetDiscoveryRepositoryImpl.js";
import { KaminoPositionFetcher } from "../data/repositories/KaminoPositionFetcher.js";
import { KaminoPortfolioClient } from "../data/sources/api/KaminoPortfolioClient.js";
import { JupiterPriceRepository } from "../data/repositories/JupiterPriceRepository.js";
import { JupiterSwapRepository } from "../data/repositories/JupiterSwapRepository.js";

export interface Blockchain {
  blockchainRepository: BlockchainRepository;
  balanceRepository: BalanceRepository;
  priceRepository: PriceRepository;
  swapRepository: SwapRepository;
  assetDiscoveryRepository: AssetDiscoveryRepository;
}

export function createBlockchain(
  config: Config,
  encryptionService: KeyEncryptionService,
): Blockchain {
  const solanaRpcClient = new SolanaRpcClient(config.solana, encryptionService);
  const walletKeyService = new WalletKeyService();
  const blockchainRepository = new SolanaBlockchainRepository(solanaRpcClient, walletKeyService);
  const balanceRepository = new CachedBalanceRepository(solanaRpcClient);

  // JUPITER_API_KEY is validated as required at config load - no degraded mode
  const priceRepository = new JupiterPriceRepository(new JupiterPriceClient(config.price.jupiterApiKey));
  const swapRepository = new JupiterSwapRepository(new JupiterSwapClient(config.price.jupiterApiKey));

  // Position fetchers (Kamino etc.) are registered here as they are added
  const assetDiscoveryRepository = new AssetDiscoveryRepositoryImpl(solanaRpcClient, [
    new KaminoPositionFetcher(new KaminoPortfolioClient()),
  ]);

  return {
    blockchainRepository,
    balanceRepository,
    priceRepository,
    swapRepository,
    assetDiscoveryRepository,
  };
}
