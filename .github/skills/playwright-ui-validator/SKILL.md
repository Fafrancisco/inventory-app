---
name: playwright-ui-validator
description: "Use when validating dashboard, shopping list, recipe, configuration, responsive, or browser interaction changes with Playwright."
---

# Playwright UI Validator

1. Start from the existing E2E fixtures and preserve deterministic API mocks.
2. Test user-visible roles, labels, and text rather than CSS selectors or implementation details.
3. Cover the changed flow at 390px and at least one desktop viewport when layout is affected.
4. Check console errors, failed requests, focus behavior, and fixed-action overlap.
5. Capture screenshots only when they provide useful visual evidence; do not commit generated artifacts unless requested.
6. Run the focused spec first, then the full E2E suite if the focused check passes.
7. Treat unrelated existing failures separately and do not weaken accessible names to preserve stale selectors.
