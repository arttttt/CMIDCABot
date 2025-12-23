/**
 * Handler context types
 */

import { UserRepository } from "../domain/repositories/UserRepository.js";
import { SolanaService } from "../services/solana.js";

export interface ServiceContext {
  userRepository: UserRepository;
  solana: SolanaService;
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
