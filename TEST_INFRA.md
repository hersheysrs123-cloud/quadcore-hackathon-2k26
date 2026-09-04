# E2E Test Infra: SocraticOS Block Note Editor Notion-Grade Navigation

## Test Philosophy
- Opaque-box, requirement-driven. Derives strictly from `ORIGINAL_REQUEST.md`.
- Evaluates DOM caret transitions, pill boundary navigation, splitting/merging invariants, bottom whitespace focus, and zero-width persistence.
- Methodology: Category-Partition + Boundary Value Analysis + Pairwise Combinatorial + Real-World Workload Testing.

## Feature Inventory
| # | Feature | Source (Requirement) | Tier 1 (>=5) | Tier 2 (>=5) | Tier 3 (Pairwise) | Tier 4 (Scenario) |
|---|---------|---------------------|:------------:|:------------:|:-----------------:|:-----------------:|
| 1 | F1: Arrow Block Navigation | R1 | 5 | 5 | ✓ | ✓ |
| 2 | F2: Inline Pill Boundary Traversal | R1 | 5 | 5 | ✓ | ✓ |
| 3 | F3: Inline Math Interaction & Auto-Compile | R2 | 5 | 5 | ✓ | ✓ |
| 4 | F4: Clean Enter Line Splitting | R3 | 5 | 5 | ✓ | ✓ |
| 5 | F5: Backspace Merging & Exact Caret | R3 | 5 | 5 | ✓ | ✓ |
| 6 | F6: Bottom Whitespace Click Focus | R4 | 5 | 5 | ✓ | ✓ |
| 7 | F7: Clean Persistence & Sanitization | R4 | 5 | 5 | ✓ | ✓ |

## Test Architecture
- **Test Runner**: Node.js Native Test Runner (`node --test tests/e2e_caret_navigation.test.js`)
- **Execution Command**: `npm test` runs full suite (all existing 184+ tests across 22 files plus new E2E test suite).
- **Test File Location**: `tests/e2e_caret_navigation.test.js`

## Coverage Thresholds
- **Tier 1 (Feature Coverage)**: 35 tests (5 per feature across F1-F7)
- **Tier 2 (Boundary & Corner Cases)**: 35 tests (5 per feature across F1-F7)
- **Tier 3 (Cross-Feature Combinations)**: 7 tests (Pairwise feature combinations)
- **Tier 4 (Real-World Application Scenarios)**: 5 application scenarios
- **Total Minimum Test Cases**: 82 test cases

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | University Math Note: Multi-block theorem with inline math formulas, line splits mid-formula, and backspace recovery | F1, F2, F3, F4, F5 | High |
| 2 | Developer Technical Spec: Mixed code spans, markdown lists, multi-line splits, and boundary crossing | F1, F2, F4, F5, F7 | High |
| 3 | Socratic Dialogue Document: Rapid conversational list items, Enter continuation, Backspace merging to parent, bottom click append | F1, F4, F5, F6, F7 | High |
| 4 | Deep Formula Derivation: Multiple inline and block equations, live math auto-compilation `$E=mc^2$`, editing adjacent terms | F2, F3, F5, F7 | High |
| 5 | Clean Document Lifecycle: Document creation, whitespace clicking, copy-paste with zero-width spaces, storage roundtrip | F6, F7, F1, F3 | High |
