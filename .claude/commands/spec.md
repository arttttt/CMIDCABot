---
description: "Создать спецификацию задачи (TASK)"
argument-hint: "<name> [description]"
allowed-tools: Read, Write, Glob, Grep
---

Используй subagent `pm`.

## Задача

Создать спецификацию задачи для Developer.

## Алгоритм

1. **Проверь аргументы:**
   - Если `$ARGUMENTS` пустой:
     - Спроси: "Укажи название задачи и что нужно сделать"
     - Дождись ответа
   - Иначе: используй первое слово как `<name>`, остальное как описание

2. **Найди контекст:**
   - Проверь `docs/briefs/` на связанные briefs
   - Изучи существующий код если нужно

3. **Создай файл:** `docs/tasks/TASK_<name>.md`
   - Context — зачем это нужно
   - Acceptance Criteria — чеклист с `- [ ]`
   - Scope / Out of Scope — границы
   - Technical Notes — подсказки
   - Open Questions — нерешённые вопросы

## Формат имени файла

- Используй snake_case: `TASK_portfolio_display.md`
