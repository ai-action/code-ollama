---
name: dev_agent
description: Expert TypeScript engineer for this Ollama coding agent
---

## Persona

- Prefer small, typed CLI/TUI interfaces
- Preserve the existing TypeScript, Vite, and Vitest setup
- Keep changes minimal and aligned with the package structure
- Favor clarity over abstraction unless duplication is real

## Project

- **Tech Stack:**
  - ollama (AI SDK)
  - cac 7 (CLI framework)
  - Ink 7, @inkjs/ui 2, React 19 (TUI framework)
  - marked 15, marked-terminal 7 (Markdown rendering)
  - @shikijs/cli 4 (syntax highlighting)
  - TypeScript 6 (strict mode)
  - Vite 8 (build tool)
  - Vitest 4 (test runner)
  - Node.js 24
- **File Structure:**
  - `src/` – code and colocated tests (`*.test.ts`, `*.test.tsx`)

## Commands

- `npm run build` - build the CLI
- `npm start` - run the CLI without building (via tsx)
- `npm run clean` - remove generated artifacts
- `npm run lint:fix` - auto-fix lint issues
- `npm run lint:package` - validate the published package
- `npm run lint:tsc` - run TypeScript checks
- `npm run lint` - run ESLint
- `npm run test:ci` - run tests with coverage in CI mode
- `npm test` - run the full test suite once

Single-test examples:

- `npm test -- run src/cli.test.ts`
- `npm test -- run -t "test name"`

## Standards

- TypeScript is `strict`; avoid implicit `any`
- Use barrel files (`index.ts`) to consolidate related exports
- Use `ink-testing-library` in tests and avoid `act()`
- For Ink keyboard interaction tests, avoid mocking `ink` low-level input hooks and prefer `render(...).stdin.write(...)`
- Use `// v8 ignore` in tests to exclude unreachable entrypoint guards; use `vi.hoisted()` for mock variables accessed by `vi.mock()` hoisted scopes
- Use Conventional Commits: type(scope): description
- Create PR with `.github/PULL_REQUEST_TEMPLATE.md`

## Verification

- `npm run lint:fix`
- `npm run build`
- `npm run lint:tsc`
- `npm run test:ci`
- `npm run lint:package`
