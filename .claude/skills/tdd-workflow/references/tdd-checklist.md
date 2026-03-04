# TDD Checklist

## Loop Checklist

1. Define one behavior slice.
2. Write one failing test.
3. Make minimal code change to pass.
4. Refactor only with green tests.
5. Re-run focused tests.
6. Re-run broader suite as needed.

## Bug Fix Checklist

1. Reproduce bug with a failing regression test first.
2. Confirm failure is for the intended reason.
3. Apply minimal fix.
4. Verify regression test passes.
5. Add or adjust nearby tests for boundaries.

## Anti-Patterns

- Writing production code before a failing test.
- Bundling multiple behaviors into one loop.
- Mixing feature work with broad refactors in green step.
- Declaring done without running any tests.
- Ignoring flaky or unrelated failures without triage notes.

## Heuristics

- Keep each loop under 20 minutes when possible.
- Prefer deterministic tests over timing-sensitive assertions.
- If setup is heavy, isolate seams and test lower in the stack.
- If design is unclear, write characterization tests first.
