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
**Status:** 🟡 Approved with comments

---

## Summary

Реализация Gateway Plugins соответствует брифу. Архитектура чистая: плагины в presentation, use case в domain. Основные замечания: дублирование `ROLE_LEVELS` между `AuthorizedUser.ts` и `RoleGuard.ts`, неконсистентное использование `ClientResponse` (объектные литералы вместо `new ClientResponse()`).

---

## Findings

### 🔴 Critical (must fix before merge)

*Критических проблем не обнаружено.*

---

### 🟡 Should Fix (important but not blocking)

#### [S1] Дублирование ROLE_LEVELS между AuthorizedUser и RoleGuard

**Location:**
- `src/domain/models/AuthorizedUser.ts:61-66`
- `src/presentation/protocol/gateway/RoleGuard.ts:12-17`

**Issue:** Иерархия ролей определена в двух местах:
```typescript
// AuthorizedUser.ts
const ROLE_LEVELS: Record<UserRole, number> = {
  owner: 3, admin: 2, user: 1, guest: 0,
};
export function hasRequiredRole(userRole: UserRole, requiredRole: UserRole): boolean {...}

// RoleGuard.ts
private static readonly ROLE_LEVELS: Record<UserRole, number> = {
  owner: 3, admin: 2, user: 1, guest: 0,
};
```

**Impact:** При изменении иерархии ролей нужно обновлять оба места. Нарушение DRY.

**Suggestion:** Варианты решения:
1. `RoleGuard` использует `hasRequiredRole` из `AuthorizedUser` (domain остаётся source of truth)
2. `RoleGuard` импортирует `ROLE_LEVELS` из `AuthorizedUser` (но они private)
3. Оставить как есть, но добавить комментарий-ссылку между файлами

Рекомендуется вариант 1:
```typescript
// RoleGuard.ts
import { hasRequiredRole } from "../../../domain/models/AuthorizedUser.js";

export class RoleGuard {
  static canAccess(role: UserRole, requiredRole: UserRole | undefined): boolean {
    if (!requiredRole) return true;
    return hasRequiredRole(role, requiredRole);
  }
}
```

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

#### [N3] HTTP identity возвращает "guest" без логирования

**Location:** `src/domain/usecases/GetUserRoleUseCase.ts:29-31`

**Observation:** HTTP identity молча fallback на `"guest"`. Когда HTTP будет реализован, легко забыть об этом месте.

**Suggestion:** Добавить TODO или warning log:
```typescript
// HTTP identity — future implementation
logger.warn("GetUserRole", "HTTP identity not implemented, returning guest");
return "guest";
```

---

## Checklist Results

| Category | Status | Notes |
|----------|--------|-------|
| Correctness | ✅ | Логика корректная, edge cases обработаны |
| Architecture | ⚠️ | Дублирование ROLE_LEVELS между layers |
| Security | ✅ | Role-based access control, mask unknown commands |
| Code Quality | ⚠️ | Inconsistent ClientResponse usage |
| Conventions | ✅ | Trailing commas, English comments, static methods |

---

## Action Items

- [ ] [S1] Устранить дублирование ROLE_LEVELS — использовать `hasRequiredRole` из domain
- [ ] [S2] Обновить handlers на `new ClientResponse(...)` вместо объектных литералов
- [ ] [N1] Рассмотреть typed errors (future task)
- [ ] [N3] Добавить TODO/log для HTTP identity (low priority)
