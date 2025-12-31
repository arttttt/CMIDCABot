<!-- GitHub Issue: #176 -->
# Code Review: /help Command Implementation

**Reviewed:**
- `src/presentation/commands/definitions.ts`
- `src/presentation/commands/handlers.ts`
- `src/presentation/commands/DevCommandRegistry.ts`
- `src/presentation/commands/ProdCommandRegistry.ts`
- `src/index.ts`

**Date:** 2025-12-31
**Status:** 🟢 Approved

## Summary

Реализация команды `/help` выполнена корректно и соответствует архитектурным требованиям. Циклическая зависимость между registry и help command решена через lazy getter паттерн. Фильтрация команд по роли использует существующий `RoleGuard`. Код чистый, типизированный, без security-проблем.

## Findings

### 🟡 Should Fix

#### [S1] Дублирование загрузки роли пользователя
**Location:** `src/presentation/commands/handlers.ts:720-723`
**Issue:** В `createHelpCommand` роль загружается через `GetUserRoleUseCase`, хотя она уже загружена в `LoadRolePlugin` и доступна в контексте Gateway.
**Impact:** Дополнительный запрос к базе данных на каждый вызов `/help`. Хотя это изолированный случай, он добавляет лишнюю нагрузку.
**Suggestion:** Документировано в TASK как известное ограничение. Исправится при миграции на `CommandExecutionContext`. Оставить как есть до миграции.

### 🟡 Should Fix

#### [S2] Использование Omit вместо явного типа
**Location:** `src/presentation/commands/DevCommandRegistry.ts:43`, `src/presentation/commands/ProdCommandRegistry.ts:34`
**Issue:** `Omit<HelpCommandDeps, "getRegistry">` сложнее читать.
**Suggestion:** Создать `HelpCommandExternalDeps` без `getRegistry`, `HelpCommandDeps` наследует от него.

### 🟢 Consider

#### [N1] Функция filterCommandsByRole не экспортирована
**Location:** `src/presentation/commands/handlers.ts:702-713`
**Issue:** Функция `filterCommandsByRole` объявлена как приватная, но может быть полезна для тестирования или повторного использования.
**Impact:** Минимальный - функция используется только внутри `createHelpCommand`.
**Suggestion:** Если в будущем понадобится тестирование фильтрации отдельно, рассмотреть экспорт. Пока оставить как есть.

#### [N2] help command включен в свой же вывод
**Location:** `src/presentation/commands/handlers.ts:724-727`
**Issue:** Команда `/help` фильтрует все команды включая саму себя. Это не ошибка, но может быть неочевидно.
**Impact:** Нет - `/help` доступна всем (guest), так что всегда будет в списке.
**Suggestion:** Поведение корректное, документация не требуется.

## Architecture Compliance

| Requirement | Status | Notes |
|-------------|--------|-------|
| Dependencies point inward | OK | Presentation -> Domain (GetUserRoleUseCase) |
| No business logic in Presentation | OK | Фильтрация по роли - это presentation logic, не business |
| Repository pattern | OK | Роль получается через use case, не напрямую |
| Use cases return domain objects | OK | GetUserRoleUseCase возвращает UserRole |
| Explicit dependencies | OK | Constructor injection через factory |
| No framework deps in domain | OK | RoleGuard в presentation, не в domain |

## Security Check

| Check | Status | Notes |
|-------|--------|-------|
| No secrets in code | OK | - |
| Input validation | OK | telegramId приходит из Telegram API |
| Role-based filtering | OK | RoleGuard.canAccess корректно проверяет иерархию |
| No information leakage | OK | Пользователь видит только доступные команды |

## Acceptance Criteria Verification

- [x] Команда `/help` зарегистрирована в `DevCommandRegistry`
- [x] Команда `/help` зарегистрирована в `ProdCommandRegistry`
- [x] Команда показывает только команды, доступные текущему пользователю
- [x] Команда показывает `modeInfo` в dev-режиме
- [x] Команда не показывает `modeInfo` в prod-режиме (`getModeInfo()` returns `null`)
- [x] Роль загружается через `GetUserRoleUseCase`
- [x] Нет hardcode в handlers - команда в стандартном роутинге
- [x] Циклическая зависимость решена через lazy getter

## Action Items

- [ ] [S1] При миграции на `CommandExecutionContext` — использовать роль из контекста вместо повторной загрузки
- [ ] [S2] Заменить `Omit<HelpCommandDeps, "getRegistry">` на явный тип `HelpCommandExternalDeps`
