# Code Review: Gateway Plugins

**Reviewed:**
- `src/domain/usecases/GetUserRoleUseCase.ts`
- `src/presentation/protocol/gateway/plugins/LoadRolePlugin.ts`
- `src/presentation/protocol/gateway/plugins/ErrorBoundaryPlugin.ts`
- `src/presentation/protocol/gateway/RoleGuard.ts`
- `src/presentation/protocol/gateway/stream.ts`
- `src/presentation/protocol/gateway/handlers/TelegramMessageHandler.ts`
- `src/presentation/protocol/gateway/handlers/TelegramCallbackHandler.ts`
- `src/presentation/protocol/types.ts`
- `src/domain/helpers/AuthorizationHelper.ts`

**Date:** 2025-12-29
**Status:** 🟢 Approved

---

## Summary

Реализация Gateway Plugins соответствует брифу. Архитектура чистая: плагины в presentation, use case в domain. Основные замечания: дублирование `ROLE_LEVELS` между `AuthorizedUser.ts` и `RoleGuard.ts`, неконсистентное использование `ClientResponse` (объектные литералы вместо `new ClientResponse()`).

---

## Findings

### 🔴 Critical (must fix before merge)

*Критических проблем не обнаружено.*

---

### 🟡 Should Fix (important but not blocking)

#### ~~[S1] Дублирование ROLE_LEVELS между AuthorizedUser и RoleGuard~~ — BY DESIGN

**Location:**
- `src/domain/models/AuthorizedUser.ts:61-66`
- `src/presentation/protocol/gateway/RoleGuard.ts:12-17`

**Note:** Дублирование сделано намеренно. `RoleGuard` — новый механизм, `hasRequiredRole` в `AuthorizedUser` будет удалён при полной миграции на Gateway. Не требует действий.

---

#### [S2] Неконсистентное использование ClientResponse в handlers

**Location:**
- `src/presentation/protocol/gateway/handlers/TelegramMessageHandler.ts:29,38,43`
- `src/presentation/protocol/gateway/handlers/TelegramCallbackHandler.ts:28,33`

**Issue:** После миграции `ClientResponse` на class, handlers используют объектные литералы:
```typescript
return StreamUtils.final({ text: GatewayMessages.UNKNOWN_COMMAND });
```

Это работает из-за structural typing, но противоречит цели рефакторинга.

**Suggestion:** Заменить на explicit instantiation:
```typescript
return StreamUtils.final(new ClientResponse(GatewayMessages.UNKNOWN_COMMAND));
```

---

### 🟢 Consider (nice to have, minor improvements)

#### [N1] ErrorBoundaryPlugin не различает типы ошибок

**Location:** `src/presentation/protocol/gateway/plugins/ErrorBoundaryPlugin.ts:28-37`

**Observation:** Все ошибки логируются одинаково и возвращают одно сообщение. Нет различия между:
- Validation errors (user input)
- Business logic errors
- Infrastructure errors

**Suggestion:** В будущем можно добавить typed errors с разными user-facing сообщениями:
```typescript
if (error instanceof ValidationError) {
  return new ClientResponse(error.message); // User-friendly message
}
// Generic error for everything else
```

---

#### [N2] GatewayContext.getRole() возвращает "guest" по умолчанию

**Location:** `src/presentation/protocol/gateway/GatewayContext.ts:33-34`

**Observation:** Если `LoadRolePlugin` не был вызван (misconfiguration), `getRole()` молча вернёт `"guest"`. Это safe default, но скрывает ошибку конфигурации.

**Suggestion:** Опционально — бросать ошибку если role не установлена:
```typescript
getRole(): UserRole {
  const role = this.state.get("userRole") as UserRole | undefined;
  if (!role) throw new Error("Role not loaded - ensure LoadRolePlugin is configured");
  return role;
}
```

Но текущее поведение тоже приемлемо (fail-safe).

---

#### ~~[N3] HTTP identity возвращает "guest" без логирования~~ — BY DESIGN

**Location:** `src/domain/usecases/GetUserRoleUseCase.ts:29-31`

**Note:** Gateway пока не поддерживает HTTP полноценно. Fallback на `"guest"` — ожидаемое поведение. Будет доработано при реализации HTTP-адаптера.

---

## Checklist Results

| Category | Status | Notes |
|----------|--------|-------|
| Correctness | ✅ | Логика корректная, edge cases обработаны |
| Architecture | ✅ | Дублирование ROLE_LEVELS — by design (миграция) |
| Security | ✅ | Role-based access control, mask unknown commands |
| Code Quality | ✅ | ClientResponse usage fixed |
| Conventions | ✅ | Trailing commas, English comments, static methods |

---

## Action Items

- [x] ~~[S1] Дублирование ROLE_LEVELS~~ — by design (миграция на RoleGuard)
- [x] [S2] Обновить handlers на `new ClientResponse(...)` вместо объектных литералов
- [ ] [N1] Рассмотреть typed errors (future task)
- [x] ~~[N3] HTTP identity~~ — by design (HTTP не реализован)
