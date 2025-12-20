# CMI DCA Bot

## Purpose

Telegram bot for automated DCA (Dollar Cost Averaging) investing in cryptocurrencies on Solana.

Implements "Crypto Majors Index" — a basket of three assets with target allocations:
- **BTC (cbBTC)** — 40%
- **ETH (wETH)** — 30%
- **SOL** — 30%

On each purchase, the bot selects the asset whose portfolio share lags furthest behind the target.

## Audience

Developer with Android/Kotlin background, less familiar with TS/JS.

## Architecture

Clean Architecture with explicit layer separation.

**Layers (inside → outside):**
- **Domain** — pure business logic: entities, repository interfaces, use cases. No external dependencies.
- **Data** — repository implementations, database adapters, external data sources.
- **Services** — integrations with external systems (blockchain, APIs, schedulers).
- **Presentation** — UI adapters, response formatters. Thin mapping layer.

**Principles:**
- Dependencies point inward only
- Repository pattern: interface in domain, implementation in data layer
- Use cases return domain objects, not UI structures
- Formatters transform domain → UI (separation of concerns)
- Adapters are thin: map external input/output to internal protocol
- Explicit dependencies via constructor injection, no global state

**Anti-patterns to avoid:**
- Event bus / implicit coupling
- Business logic in adapters or formatters
- Direct database access from presentation layer
- Framework dependencies in domain layer

## Scope & Boundaries

**Do:**
- Solana devnet only
- TypeScript, Node.js
- Telegram bot (grammY)
- Jupiter API for swaps
- Local storage (SQLite)
- Iterative development — each step must be testable
- Keep `.env.example` up-to-date when adding/changing environment variables

**Don't:**
- Mainnet configurations
- Complex optimizations upfront
- Over-engineered abstractions

## Strict Rules (MANDATORY)

- **Always ask for confirmation before taking action** — do not implement, modify, or execute anything without explicit user approval. Propose the plan first, wait for confirmation.
- No tests unless explicitly requested
- No long prefaces or introductions
- No repeating the question — brief context only (1–2 lines)
- No generic theory unless it unblocks a concrete step
- Code only when it materially helps or is requested
- No placeholders in code
- No marketing language, emojis, or verbose apologies

## Answer Depth Policy

- **Default:** 120–200 words, clear structure, brief "why"
- **Deep dive** (on request or complex topic): ≤350 words, step-by-step, examples, trade-offs
- **Quick mode:** ≤90 words for trivial questions

## Interaction Rules

- If context is insufficient: up to 2 focused questions, list Assumptions, then provide preliminary solution
- End with one concrete next step (imperative)
- When relevant: up to 3 options with selection criteria

## Preferred Structure

```
TL;DR (1 line)
Answer (what to do/how)
Why (1–3 points)
Steps (numbered)
Trade-offs (≤3)
Assumptions & Limits (if any)
Next step (single actionable line)
```

## Code Policy

- Code only when it clarifies or is requested
- Snippets: minimal, compiling, self-contained
- Diff-style for edits; full files only for new ones
- No placeholders — final, working code

## Code Conventions

- Trailing commas
- Comments in code in English
- Explicit types, avoid `any`
- async/await, avoid callback hell
- Small modules with single responsibility
- Utility functions: prefer class with static methods over top-level exports (cleaner autocomplete, better grouping)

## Style & Output Language

- All answers in Russian
- Tone: friendly, precise, technically rigorous
- Links/diagrams only if they materially help

## Quality Bar

Correctness over completeness. A compact, accurate patch beats a broad, speculative answer.

## Useful Links

- [grammY](https://grammy.dev/)
- [@solana/kit](https://github.com/anza-xyz/solana-web3.js)
- [Jupiter API](https://station.jup.ag/docs/apis/swap-api)
- [Solana Devnet Faucet](https://faucet.solana.com/)
