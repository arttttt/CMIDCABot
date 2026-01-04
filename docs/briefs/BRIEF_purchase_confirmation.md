<!-- GitHub Issue: #210 -->
# Brief: Purchase Confirmation

## Problem Statement

Команды `/portfolio buy` и `/swap execute` выполняются немедленно без подтверждения. Ошибка в указании суммы приводит к нежелательной покупке, которую невозможно отменить.

## Proposed Solution

Добавить inline-кнопки (Confirm/Cancel) перед выполнением транзакции. Пользователь видит детали операции и явно подтверждает или отменяет её.

## Scope

Команды, требующие подтверждения:
- `/portfolio buy <amount>` — покупка актива для ребалансировки портфеля
- `/swap execute <amount> [asset]` — обмен токенов

## Technical Context

- Затрагивает: `createPortfolioBuyCommand`, `createSwapExecuteCommand` в `handlers.ts`
- В проекте уже есть инфраструктура callbacks:
  - `Command.callbacks` — регистрация обработчиков callback-кнопок
  - `TelegramCallbackHandler` — обработка нажатий
  - `InlineKeyboard` (grammY) — создание inline-клавиатуры

## Suggested Approach

1. Показать пользователю превью операции (сумма, актив, примерный курс)
2. Отобразить две inline-кнопки: "Confirm" и "Cancel"
3. При подтверждении — выполнить транзакцию
4. При отмене — удалить сообщение или показать "Cancelled"

## Open Questions for PM

1. **Таймаут подтверждения** — отменять запрос автоматически через N минут бездействия?
2. **Retry при изменении цены** — если quote устарел к моменту подтверждения, показывать обновлённую цену и запрашивать повторное подтверждение?

## References

- `/Users/artem/.claude-worktrees/DCATgBot/quizzical-edison/src/presentation/commands/handlers.ts`
- `/Users/artem/.claude-worktrees/DCATgBot/quizzical-edison/src/presentation/commands/types.ts`
- `/Users/artem/.claude-worktrees/DCATgBot/quizzical-edison/src/presentation/telegram/TelegramAdapter.ts`
