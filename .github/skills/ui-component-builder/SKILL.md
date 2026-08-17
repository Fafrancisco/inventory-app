---
name: ui-component-builder
description: "Use when creating or refactoring React UI components, Tailwind styles, forms, dialogs, buttons, tabs, badges, or inventory cards in this repository."
---

# UI Component Builder

1. Identify the narrowest reusable boundary and preserve the current public behavior.
2. Use project-owned primitives in `components/ui`; add a primitive only when it removes repeated interaction or accessibility logic.
3. Use Lucide icons for controls and give icon-only buttons an accessible name, visible focus state, and a minimum 40px touch target.
4. Design the 390px mobile state first, then verify desktop width and long Portuguese labels.
5. Include loading, empty, error, disabled, and success states when the component can encounter them.
6. Keep mutations recoverable: optimistic updates require rollback and visible failure feedback.
7. Add or update a focused component or E2E test for changed behavior.
8. Validate with `npx tsc --noEmit` and the narrowest relevant test before moving to another slice.
