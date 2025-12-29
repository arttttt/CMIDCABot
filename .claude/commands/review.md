---
description: "Code review файлов или компонента"
argument-hint: "<file_path> | <component_name>"
allowed-tools: Read, Glob, Grep, Write
---

Используй subagent `reviewer`.

## Задача

Провести code review и создать отчёт.

## Алгоритм

1. **Проверь аргументы:**
   - Если `$ARGUMENTS` пустой:
     - Спроси: "Что ревьюить? Укажи путь к файлу или название компонента"
   - Иначе: используй как scope ревью

2. **Прочитай `prompts/ARCHITECTURE.md`** — обязательно перед ревью

3. **Проанализируй код:**
   - Correctness
   - Architecture compliance
   - Security
   - Code quality

4. **Создай файл:** `docs/reviews/REVIEW_<name>.md`

## Формат имени файла

- По компоненту: `REVIEW_portfolio_handler.md`
- По фиче: `REVIEW_dca_scheduling.md`
