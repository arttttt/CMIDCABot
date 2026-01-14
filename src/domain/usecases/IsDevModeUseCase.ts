/**
 * Check dev wallet mode use case
 */

import { DcaWalletConfig } from "../../infrastructure/shared/config/index.js";

export class IsDevModeUseCase {
  constructor(private config: DcaWalletConfig) {}

  execute(): boolean {
    return !!this.config.devPrivateKey;
  }
}
