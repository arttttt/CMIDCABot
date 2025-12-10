/**
 * Handler context types
 */

import { UserRepository } from "../data/repositories/interfaces/UserRepository.js";
import { SolanaService } from "../services/solana.js";
import { DcaService } from "../services/dca.js";

export interface ServiceContext {
  userRepository: UserRepository;
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
