---
name: responsive-ui-reviewer
description: "Use when reviewing or polishing responsive React UI, mobile PWA layouts, fixed actions, forms, filters, cards, or visual regressions in the inventory app."
---

# Responsive UI Reviewer

Review at minimum 390x844 and a desktop viewport.

- Check horizontal overflow, clipped text, and controls that shift when labels or values change.
- Check fixed actions against mobile safe areas and keyboard-visible form states.
- Check touch targets, focus rings, contrast, and reduced-motion behavior.
- Check empty, loading, error, disabled, and long-content states.
- Check that low-stock and selected states are not communicated by color alone.
- Check that hierarchy supports the next action: inventory quantity, shopping action, recipe action, or recovery.
- Use Playwright screenshots for visual evidence when a layout change is substantial.
