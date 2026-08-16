# SocraticOS Assistant Rules & Documentation Maintenance Directives

Whenever you make changes to the codebase (features, components, architecture, design tokens, bug fixes), you must maintain documentation integrity by updating the relevant documentation files as part of your task.

---

## 📋 Mandatory Documentation Rules for All Tasks

### 1. Codebase Architecture & Feature Changes (`CODEBASE_SUMMARY.md` & `README.md`)
- If you modify, add, or refactor components, routes, database schemas, or storage services:
  - **UPDATE [`CODEBASE_SUMMARY.md`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/CODEBASE_SUMMARY.md)** to reflect the updated component tree, state flows, APIs, and gotchas.
  - **UPDATE [`README.md`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/README.md)** if feature capabilities, setup steps, or directory structure changed.

### 2. UI & Design Token Changes (`DESIGN_SYSTEM.md`)
- If you add, modify, or refactor colors, typography, layout tokens, theme classes, or UI component conventions:
  - **UPDATE [`DESIGN_SYSTEM.md`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/DESIGN_SYSTEM.md)** to keep design tokens, color scales, and component specs authoritative.

### 3. Bug Fixes (`ANTIGRAVITY_BUG_FIXES.md` & `ANTIGRAVITY_BUG_FIXES`)
- If you fix a bug, resolve an edge case, or solve a regression:
  - **UPDATE [`ANTIGRAVITY_BUG_FIXES.md`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/ANTIGRAVITY_BUG_FIXES.md)** (and sync [`ANTIGRAVITY_BUG_FIXES`](file:///c:/Users/Sivabalan/Documents/GitHub/quadcore-hackathon-2k26/ANTIGRAVITY_BUG_FIXES)) documenting the root cause, problem statement, and resolution.

### 4. Excluded Files
- **DISREGARD `BUGFIX_REPORT.md`**: Do not update or modify this file.
