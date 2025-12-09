/**
 * Handler context types
 */

import { DatabaseService } from "../db/index.js";
import { SolanaService } from "../services/solana.js";
import { DcaService } from "../services/dca.js";

export interface ServiceContext {
  db: DatabaseService;
  solana: SolanaService;
  dca?: DcaService;
}

export interface MessageContext {
  userId: string;
  telegramId: number;
  username?: string;
  text: string;
}

export interface InlineButton {
  text: string;
  callbackData: string;
}

export interface MessageResponse {
  text: string;
  inlineKeyboard?: InlineButton[][];
}
