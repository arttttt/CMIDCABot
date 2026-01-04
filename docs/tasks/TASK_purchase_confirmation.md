<!-- GitHub Issue: #210 -->

# Task: Purchase Confirmation Flow

## Context

Currently `/portfolio buy` and `/swap execute` commands execute transactions immediately without user confirmation. This creates risk of accidental purchases and poor UX when prices change between quote and execution. Adding a confirmation step with price protection improves safety and user control.

## Acceptance Criteria

- [ ] `/portfolio buy` shows preview before execution (amount, asset, rate) with Confirm/Cancel buttons
- [ ] `/swap execute` shows preview before execution (amount, asset, rate) with Confirm/Cancel buttons
- [ ] Confirmation times out after 1 minute with message "Confirmation expired"
- [ ] On Confirm: fresh quote is requested from Jupiter API
- [ ] If price difference <= `quote.slippageBps` (0.5%): transaction executes
- [ ] If price difference > slippage: new price is shown, user is asked to confirm again (re-quote flow)
- [ ] On second slippage exceed: transaction is cancelled with explanation
- [ ] Cancel button immediately cancels the operation

## Scope

- Confirmation flow for `/portfolio buy` command
- Confirmation flow for `/swap execute` command
- Timeout handling (1 minute)
- Slippage check against `quote.slippageBps`
- Single re-confirmation on slippage exceed
- User feedback messages for all states

## Out of Scope

- Customizable timeout duration
- Customizable slippage threshold (uses `quote.slippageBps`)
- Confirmation for other commands
- Transaction history or logging changes
- Notification settings

## Technical Notes

- Modify `createPortfolioBuyCommand` and `createSwapExecuteCommand` in `handlers.ts`
- Use existing callback infrastructure: `Command.callbacks`, `TelegramCallbackHandler`, `InlineKeyboard`
- Store original quote data to compare with fresh quote on confirmation
- Slippage threshold comes from `quote.slippageBps` (default 0.5% = 50 bps)
- Consider callback data format: `confirm_buy:<asset>:<amount>` or similar
- Timeout can be implemented via `setTimeout` + callback invalidation
