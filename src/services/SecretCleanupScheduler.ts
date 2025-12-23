/**
 * @deprecated Use CleanupScheduler from infrastructure/shared/scheduling instead
 */
import { CleanupScheduler } from "../infrastructure/shared/scheduling/index.js";

export type { CleanableStore } from "../infrastructure/shared/scheduling/index.js";

/**
 * @deprecated Use CleanupScheduler instead
 */
export const SecretCleanupScheduler = CleanupScheduler;
