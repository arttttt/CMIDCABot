# Task: Удаление синглтона KeyEncryptionService

## Context

Модуль шифрования использует синглтон-паттерн (`getEncryptionService()`, `initializeEncryption()`), что создаёт скрытое глобальное состояние. Это нарушает принцип explicit dependencies и затрудняет unit-тестирование. Рефакторинг устранит замечание SEC-03 из security review.

## Acceptance Criteria

- [ ] Функция `getEncryptionService()` удалена из `KeyEncryption.ts`
- [ ] Функция `initializeEncryption()` удалена из `KeyEncryption.ts`
- [ ] Модульная переменная `let encryptionService` удалена
- [ ] Экспорты удалённых функций убраны из `crypto/index.ts`
- [ ] В `src/index.ts` сервис создаётся явно: `new KeyEncryptionService()`
- [ ] Приложение запускается без ошибок (`npm run dev`)
- [ ] Компиляция проходит успешно (`npm run build`)

## Scope

- Удаление синглтон-инфраструктуры из `KeyEncryption.ts`
- Обновление barrel export в `crypto/index.ts`
- Обновление точки входа `src/index.ts`

## Out of Scope

- Добавление unit-тестов (отдельная задача)
- Рефакторинг других синглтонов в проекте
- Изменение логики шифрования
- Изменение потребителей сервиса (они уже используют DI)

## Technical Notes

- DI уже работает: все потребители (`SQLiteUserRepository`, `SolanaRpcClient`, `SecretCache`) получают сервис через конструктор
- Изменения затрагивают только 3 файла
- Breaking changes отсутствуют — публичный API класса `KeyEncryptionService` не меняется

## Open Questions

*Нет — scope определён.*
