/**
 * Message handler abstraction - processes messages independent of transport (Telegram/Web)
 */

import { CommandMode } from "../types/commands.js";
import { handleWalletCallback } from "../commands/handlers/index.js";

// Re-export types for backward compatibility
export {
  ServiceContext,
  MessageContext,
  InlineButton,
  MessageResponse,
} from "../types/handlers.js";

import {
  ServiceContext,
  MessageContext,
  MessageResponse,
} from "../types/handlers.js";

/**
 * Handler context that includes command mode
 */
export interface HandlerContext {
  services: ServiceContext;
  commandMode: CommandMode;
}

/**
 * Processes a user message and returns a response
 * This is the core logic that both Telegram bot and web interface use
 */
export async function handleMessage(
  ctx: MessageContext,
  handlerCtx: HandlerContext,
): Promise<MessageResponse> {
  const text = ctx.text.trim();

  // Handle commands
  if (text.startsWith("/")) {
    const parts = text.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);
    return handleCommand(command, args, ctx, handlerCtx);
  }

  // Handle plain text
  return {
    text: "Unknown command. Use /help to see available commands.",
  };
}

async function handleCommand(
  command: string,
  args: string[],
  ctx: MessageContext,
  handlerCtx: HandlerContext,
): Promise<MessageResponse> {
  const { services, commandMode } = handlerCtx;

  // Handle special commands that need dynamic content
  if (command === "/start") {
    services.db.createUser(ctx.telegramId);
    services.dca?.createPortfolio(ctx.telegramId);
    return {
      text: commandMode.getStartMessage(),
    };
  }

  if (command === "/help") {
    return {
      text: commandMode.getHelpText(),
    };
  }

  // Look up handler in command mode
  const handler = commandMode.getHandler(command);
  if (handler) {
    return handler(args, ctx, services);
  }

  return {
    text: `Unknown command: ${command}\nUse /help to see available commands.`,
  };
}

/**
 * Handle callback queries from inline keyboards
 */
export async function handleCallback(
  telegramId: number,
  callbackData: string,
  services: ServiceContext,
): Promise<MessageResponse> {
  // Try wallet callback handler
  const walletResponse = await handleWalletCallback(telegramId, callbackData, services);
  if (walletResponse) {
    return walletResponse;
  }

  return {
    text: "Unknown action.",
  };
}
