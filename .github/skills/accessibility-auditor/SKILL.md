---
name: accessibility-auditor
description: "Use when auditing React UI accessibility, keyboard navigation, forms, dialogs, icon buttons, color contrast, or WCAG regressions."
---

# Accessibility Auditor

- Prefer semantic HTML and native controls before adding ARIA.
- Verify every control has an understandable accessible name in Portuguese (Portugal).
- Verify keyboard order, visible focus, Escape behavior, and focus after dialogs or inline edits.
- Verify labels, instructions, validation messages, and error summaries are associated with controls.
- Verify status is not conveyed by color alone and progress values have an accessible label.
- Check touch targets are at least 40px and interactive regions do not overlap.
- Run an automated axe scan when the test environment supports it, then manually test the primary flow.
- Report any automated finding with the affected component and a user-facing consequence.
