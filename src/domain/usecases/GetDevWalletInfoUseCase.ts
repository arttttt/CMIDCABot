/**
 * Get dev wallet info use case
 */

import { DcaWalletConfig } from "../../infrastructure/shared/config/index.js";
import { GetWalletInfoByPrivateKeyUseCase } from "./GetWalletInfoByPrivateKeyUseCase.js";
import type { DcaWalletInfo } from "./types.js";

export class GetDevWalletInfoUseCase {
  constructor(
    private config: DcaWalletConfig,
    private getWalletInfoByPrivateKey: GetWalletInfoByPrivateKeyUseCase,
  ) {}

  async execute(): Promise<DcaWalletInfo> {
    return this.getWalletInfoByPrivateKey.execute(this.config.devPrivateKey!, true);
  }
}
