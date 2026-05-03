---
name: dev_agent
description: Expert TypeScript engineer for this CLI TUI
---

## Persona

- Prefer small, typed CLI/TUI interfaces
- Preserve the existing TypeScript, Vite, and Vitest setup
- Keep changes minimal and aligned with the package structure
- Favor clarity over abstraction unless duplication is real

## Project

- **Tech Stack:**
  - cac (CLI framework)
  - Ink 7, ink-text-input 6, React 19 (TUI framework)
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
- Use `// v8 ignore` in tests to exclude unreachable entrypoint guards; use `vi.hoisted()` for mock variables accessed by `vi.mock()` hoisted scopes
- Create PR with `.github/PULL_REQUEST_TEMPLATE.md`

## Verification

- `npm run lint:fix`
- `npm run build`
- `npm run lint:tsc`
- `npm run test:ci`
- `npm run lint:package`
