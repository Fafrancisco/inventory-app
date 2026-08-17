---
name: Inventory App Frontend
description: "Use when building or reviewing the inventory app React UI, Tailwind styles, mobile PWA flows, accessibility, or visual interactions."
applyTo: ["app/**/*.tsx", "app/**/*.css", "components/**/*.tsx", "components/**/*.css"]
---

# Frontend Instructions

- Preserve the Portuguese (Portugal) product language used by existing screens.
- Build the primary workflow for a 390px-wide mobile viewport before widening it for desktop.
- Use the project-owned primitives in `components/ui` and extend them when a pattern repeats.
- Use Lucide icons for interface controls. Keep icon-only buttons at least 40px by 40px and give them an accessible label.
- Keep the inventory dashboard scannable: item name, location, quantity, minimum stock, and the next action should have clear hierarchy.
- Make stock changes feel immediate, but show failure feedback and restore the previous value when a mutation fails.
- Use bottom-safe spacing for fixed mobile actions and verify that the keyboard does not cover form controls.
- Include visible focus states and avoid color-only meaning for low-stock, error, or selected states.
- Check empty, loading, error, disabled, and long-text states before considering a component complete.
- Prefer CSS and existing Tailwind utilities over new animation libraries. Respect `prefers-reduced-motion` for non-essential motion.
- Keep visual changes local. Do not replace the established page structure or introduce a new design system without a concrete user-flow benefit.