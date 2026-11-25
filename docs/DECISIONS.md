# Decisions log

Short entries for every choice that was not obvious from the spec.
Format: **Decision** · *Why* · *Alternative discarded*.

## Tooling

1. **AdonisJS pinned to v6 (`@adonisjs/core@^6.18`), API scaffolded from the official `api-starter-kit` at its last v6 revision.** · npm `latest` is already v7, and the spec requires v6. The kit pins a coherent set of ecosystem versions (assembler 7, japa 4, vine 3, cors 2, limiter 2). · `create-adonisjs@latest`, which would scaffold v7.
2. **TypeScript `~5.8` everywhere.** · TS 7 (native port) is `latest`, but Adonis v6 tooling (ts-node-maintained, @adonisjs/tsconfig 1.x) and typescript-eslint target TS 5.x. · TS 7.
3. **ESLint 9 everywhere.** · `@adonisjs/eslint-config@2` targets ESLint 9. One major across the monorepo avoids plugin mismatches. · ESLint 10.
4. **`packages/shared` is compiled to `dist/` (tsc) and built in the root `postinstall`.** · Adonis runs through a ts-node ESM loader, which does not reliably transpile `.ts` reached through workspace symlinks. Shipping JS + `.d.ts` works the same way for Node, Vite and Vitest. · Pointing `exports` at `src/*.ts`.
5. **pnpm pinned to the local version (12.11.2) via `packageManager`; `allowBuilds` only whitelists `@swc/core`.** · pnpm ≥10 blocks dependency build scripts by default; swc needs its postinstall to fetch the native binary. · Allowing all build scripts.
6. **Mongoose 8.x, not 9.x.** · 8.x is mature and widely documented. 9.x brings no feature this app needs. · Mongoose 9.
7. **Codex CLI (0.171) and Ollama are available and used as the spec describes**: Codex as an independent reviewer, Ollama (`qwen2.5-coder:14b`) only for low-risk drafts.
8. **Validation: shared `LIMITS` constants feed both VineJS (API HTTP layer) and zod (web forms + Socket.io payloads).** · The two validators cannot share schema objects, but sharing the numbers keeps them aligned. A test asserts that both reject the same edge cases. · Using zod in the API too, which would bypass the Adonis-native VineJS the spec asks for.
