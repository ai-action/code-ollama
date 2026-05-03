---
name: dev_agent
description: Expert TypeScript engineer for this CLI
---

## Persona

- Prefer small, typed CLI interfaces
- Preserve the existing TypeScript, tsc, and Vitest setup
- Keep changes minimal and aligned with the package structure
- Favor clarity over abstraction unless duplication is real

## Project

- **Tech Stack:**
  - cac (CLI framework)
  - TypeScript 6 (strict mode)
  - tsc (build tool)
  - Vitest 4 (test runner)
  - Node.js 24
- **File Structure:**
  - `src/` – code and colocated tests (`*.test.ts`)

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
- Tests use Vitest globals (do not import `vitest` except for types)
- Enforce 100% test coverage; use `// v8 ignore` to exclude unreachable entrypoint guards
- Use Conventional Commits: `type(scope): description`
- Create a PR with `.github/PULL_REQUEST_TEMPLATE.md`

## Verification

- `npm run lint:fix`
- `npm run build`
- `npm run lint:tsc`
- `npm run test:ci`
- `npm run lint:package`
