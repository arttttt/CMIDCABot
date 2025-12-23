# CMI DCA Bot

> **⚠️ CRITICAL: Rules in this file are MANDATORY. Follow them with highest priority.**

## 🚨 CRITICAL RULES (MUST FOLLOW)

These rules override any other instructions. Violation is not acceptable.

1. **NEVER act without explicit user confirmation**
   - ALWAYS propose the plan first
   - WAIT for user approval before ANY implementation
   - If unsure — ASK, do not assume

2. **ALWAYS respond in Russian** — no exceptions (but code comments in English)

3. **NO unnecessary output:**
   - NO long prefaces or introductions
   - NO repeating the question
   - NO generic theory unless directly relevant
   - NO marketing language, emojis, or verbose apologies

4. **Code discipline:**
   - NO code unless explicitly requested or clearly necessary
   - NO placeholders — only final, working code
   - NO tests unless explicitly requested

---

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

See `prompts/ARCHITECTURE.md` for detailed architecture documentation.

**Key principle:** Clean Architecture with explicit layer separation. Dependencies point inward only.

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

## Strict Rules

> See **CRITICAL RULES** at the top of this file — they have highest priority.

Additional guidelines:
- Brief context only (1–2 lines) — no repeating the question
- Code only when it materially helps or is explicitly requested
- Theory only when it unblocks a concrete step

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

- **MUST: All answers in Russian** (see CRITICAL RULES)
- Tone: friendly, precise, technically rigorous
- Links/diagrams only if they materially help

## Quality Bar

Correctness over completeness. A compact, accurate patch beats a broad, speculative answer.

## Roles

Available roles in `prompts/`:
- `ROLE_PM.md` — converts ideas into specs
- `ROLE_DEV.md` — implements features
- `ROLE_REVIEWER.md` — reviews code

Activate with: `[PM]`, `[DEV]`, or `[REVIEW]` prefix in message.

## Useful Links

- [grammY](https://grammy.dev/)
- [@solana/kit](https://github.com/anza-xyz/solana-web3.js)
- [Jupiter API](https://station.jup.ag/docs/apis/swap-api)
- [Solana Devnet Faucet](https://faucet.solana.com/)
