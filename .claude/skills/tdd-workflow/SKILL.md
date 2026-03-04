---
name: tdd-workflow
description: Test-driven development workflow for implementing code changes with Red-Green-Refactor, including test planning, minimal failing tests, smallest passing implementation, and safe cleanup. Use when the user asks for TDD, tests-first development, red-green-refactor, bug fixes with regression tests, or safer refactoring with behavior protection.
---

# TDD Workflow

Apply a strict Red-Green-Refactor loop for every code change. Keep loops small, prove behavior with tests, and avoid broad edits without failing tests first.

## Quick Start

1. Define one observable behavior to change.
2. Choose the narrowest test scope that can verify it.
3. Write one failing test with a clear failure reason.
4. Implement the smallest production change to make that test pass.
5. Run the target test, then a broader related set.
6. Refactor while keeping all tests green.
7. Repeat with the next behavior slice.

## Workflow Steps

### Step 1: Define Behavior and Boundaries

- State expected input, output, and side effects in 1-3 bullets.
- Freeze scope to a single behavior slice.
- Capture edge cases that must be protected.

### Step 2: Write the Red Test

- Prefer one assertion cluster for one behavior.
- Make failure messages specific enough to point to intent.
- Run only the smallest relevant test target first.

### Step 3: Make It Green

- Implement the smallest change that satisfies the failing test.
- Avoid opportunistic refactors during this step.
- Re-run the same target test until green.

### Step 4: Refactor Safely

- Improve naming, duplication, and structure without changing behavior.
- Keep each refactor mechanical and reversible.
- Re-run target tests after each small refactor.

### Step 5: Broaden Verification

- Run the related suite after local green.
- Run full suite before finalizing when change impact is unclear.
- Stop and isolate if unrelated tests fail.

## Test Scope Selection

- Choose unit tests for pure logic and narrow branches.
- Choose integration tests for component boundaries and collaboration.
- Choose regression tests first for bug fixes, then add unit tests if a pure seam exists.
- Avoid starting with end-to-end tests unless the defect only reproduces there.

## Repo Command Pattern

- Run focused test file:
```bash
npm test -- tests/path/to/test-file.test.ts
```
- Run focused test name pattern:
```bash
npm test -- "TestNameOrFeature"
```
- Run complete suite:
```bash
npm test
```

Use the smallest command that gives confidence first, then expand.

## Output Requirements

- Report each Red-Green-Refactor loop explicitly.
- List tests added or changed with file paths.
- State which commands were run and which failed or passed.
- Call out remaining risk if full-suite verification was skipped.

## Reference

- Read `references/tdd-checklist.md` for checklists and anti-patterns before complex changes.
