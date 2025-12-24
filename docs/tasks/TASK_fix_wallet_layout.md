# Task: Fix Recovery Phrase Page Layout

## Context
На странице отображения Recovery Phrase (`/secret/:token`) сломана вёрстка: grid-сетка со словами вылезает за границы контейнера, а текст внутри ячеек выровнен хаотично.

## Acceptance Criteria
- [ ] Блок `.words` не выходит за границы родительского контейнера на любой ширине экрана (≥320px)
- [ ] Номер слова и само слово выровнены единообразно во всех ячейках (номер слева, слово после него)
- [ ] Длинные слова (например, "umbrella", "ordinary") не ломают layout
- [ ] Вёрстка корректно работает для 12-словных и 24-словных фраз

## Scope
- Файл `src/presentation/web/SecretPageHandler.ts`, метод `sendSeedPhrasePage`
- Только CSS-правки, без изменения HTML-структуры

## Out of Scope
- Страница Private Key (`sendPrivateKeyPage`)
- Страницы Expired/Error
- Функциональные изменения (логика, безопасность)

## Technical Notes
Текущие проблемы в CSS:

```css
/* .secret-box — нет overflow control */
.words {
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;  /* слишком большой gap для узких экранов */
}
.word {
  justify-content: center;  /* вызывает "плавающие" номера */
  padding: 12px 8px;
}
.num {
  min-width: 24px;  /* недостаточно для двузначных номеров */
}
```

Рекомендуемые изменения:

```css
.secret-box {
  overflow: hidden;
}
.words {
  gap: 8px;
}
.word {
  justify-content: flex-start;
  padding: 10px 12px;
}
.num {
  min-width: 28px;
  flex-shrink: 0;
}
```

## Open Questions
- Нет
