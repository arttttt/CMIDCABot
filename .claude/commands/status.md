---
description: "Проверить статус задачи (briefs, specs, reviews)"
argument-hint: "[name]"
allowed-tools: Read, Glob, Grep
---

## Задача

Показать какие артефакты существуют по задаче.

## Алгоритм

1. **Проверь аргументы:**
   - Если `$ARGUMENTS` пустой:
     - Покажи общую статистику по `docs/`
   - Иначе: ищи артефакты по имени `<name>`

2. **Найди артефакты:**
   - `docs/briefs/BRIEF_*<name>*.md`
   - `docs/tasks/TASK_*<name>*.md`
   - `docs/reviews/REVIEW_*<name>*.md`

3. **Выведи статус:**

```
## Status: <name>

| Артефакт | Статус | Файл |
|----------|--------|------|
| Brief    | ✅/❌  | path |
| Spec     | ✅/❌  | path |
| Review   | ✅/❌  | path |

### Следующий шаг
[Что нужно сделать дальше]
```

## Без аргументов — общая статистика

```
## Project Status

**Briefs:** X файлов
**Tasks:** Y файлов
**Reviews:** Z файлов

### Недавние
- BRIEF_xxx.md (date)
- TASK_yyy.md (date)
```
