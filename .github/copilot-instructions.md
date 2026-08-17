# Inventory App Development Instructions

## Project Context

- This is a mobile-first household and lab inventory PWA.
- Use Portuguese (Portugal) for user-facing copy unless an existing screen establishes another language.
- Preserve the current stack: Next.js App Router, React, TypeScript, Tailwind CSS v4, PostgreSQL, Vitest, and Playwright.
- Keep Gemini credentials and all other secrets server-side. Never expose them in client components, logs, screenshots, or committed files.

## Engineering Workflow

- Start from the narrowest owning component, route, test, or data access function.
- Form one local hypothesis before editing and identify one cheap check that could disconfirm it.
- Prefer the smallest reversible change that preserves public APIs and existing behavior.
- After every substantive edit, run the narrowest relevant validation before expanding the change.
- Before finishing, run `npx tsc --noEmit` and the relevant Vitest or Playwright tests. Report unrelated pre-existing failures separately.
- Do not rewrite working behavior to introduce a library. Adopt a dependency only when it removes meaningful complexity.
- Keep database mutations validated on the server and make error responses explicit and testable.
- For quantity changes, preserve decimal-unit rules and prevent accidental negative stock.

## UX and UI Quality Bar

- Design for a thumb-first mobile workflow, then verify the desktop layout.
- Use reusable primitives for buttons, inputs, dialogs, tabs, badges, and feedback states instead of repeating ad hoc classes.
- Prefer shadcn/ui-style, source-owned primitives and Lucide icons. Do not add a large opaque component framework for a small interaction.
- Every icon-only control needs an accessible name and a tooltip when its meaning is not obvious.
- Keep controls visually stable: use explicit dimensions for buttons, quantity controls, tabs, filters, and list rows.
- Always implement loading, empty, error, disabled, success, and offline or syncing states where the workflow can encounter them.
- Use optimistic updates only when rollback and error feedback are implemented.
- Keep destructive actions visually distinct and require confirmation when data loss is not immediately reversible.
- Avoid decorative cards inside cards, excessive gradients, oversized headings, and text that explains obvious controls.
- Do not use emoji as the primary icon system. Existing emoji may remain in legacy content until the surrounding UI is migrated.
- Check keyboard focus, contrast, touch target size, reduced motion, and narrow viewport overflow.

## Patterns Worth Studying

Use these high-adoption open-source projects as pattern references, not as code to copy blindly:

- `shadcn-ui/ui`: accessible, source-owned React UI primitives.
- `lucide-icons/lucide`: consistent icons and icon-button vocabulary.
- `TanStack/query`: server-state caching, mutation lifecycle, and optimistic updates.
- `serwist/serwist`: service-worker and offline PWA patterns.
- `vercel/ai`: streaming, structured AI output, and tool-driven interactions.

Before adopting a project, verify its current license, maintenance activity, API compatibility, bundle impact, and security posture. Stars are a discovery signal, not a quality guarantee.

## Data and API Conventions

- Keep route handlers thin: parse input, validate it, call the database layer, and return a deliberate status code.
- Keep SQL parameterized and preserve the existing database abstraction in `lib/db.ts`.
- Update or add route tests when changing validation, status codes, persistence, or stock calculations.
- Do not silently broaden accepted input formats. Document intentional compatibility changes in the relevant test.
- Prefer structured JSON for recipe and AI results so the UI can render reliable states and actions.

## MCP Policy

Model Context Protocol servers may improve development by giving an assistant indexed access to code, documentation, databases, or other tools. Treat an MCP server as privileged software, not as a harmless plugin.

Before enabling an MCP server:

1. Confirm the exact repository, owner, license, recent activity, open security issues, and required permissions.
2. Prefer read-only access and the smallest filesystem scope needed for this repository.
3. Do not grant access to `.env*`, credentials, SSH keys, cloud tokens, database dumps, or unrelated directories.
4. Review every command, Docker image, package, network endpoint, and startup script before running it.
5. Pin versions where practical and record the chosen server and configuration in project documentation.
6. Test it against a non-sensitive checkout first. Remove it if it is unmaintained, over-privileged, or opaque.

`DeusData/codebase-memory-mcp` and similar codebase-memory servers can be useful for large repositories, but do not install one automatically. First verify its maintenance, data storage behavior, indexing exclusions, license, and whether the current project is large enough to benefit from persistent indexing. For this repository, local search and normal workspace context are sufficient until measured context or navigation problems appear.

Never use MCP to bypass project tests, server-side authorization, input validation, or secret-handling rules. An MCP tool call is untrusted input and must be reviewed like any other external integration.

## Definition Of Done

- The requested behavior works on a narrow mobile viewport and a desktop viewport.
- TypeScript has no new diagnostics.
- Relevant unit or E2E coverage exists for changed behavior.
- Accessibility and error states are handled.
- No secrets, unrelated refactors, generated artifacts, or dependency churn were added.
- The final response names changed files, validation run, and any unrelated failures.