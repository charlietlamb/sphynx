---
name: references
description: Use the Mobbin MCP to research real-world UI references from top design companies. Use when building steppers, forms, flows, workflows, onboarding, or any UI pattern that benefits from studying how the best products handle it.
---

# References

## Purpose

Before building a UI pattern, study how the best products do it. Use the Mobbin MCP tools to search for real screens, flows, and patterns from reference companies. Look at the actual images, think about the design choices, and incorporate the best ideas into your implementation.

## Workflow

1. **Search for the pattern** using `mobbin_search_screens` and `mobbin_search_flows` with relevant keywords (e.g. "stepper", "form", "onboarding", "checkout", "workflow", "settings").
2. **Search by company** using `mobbin_search_apps` or `mobbin_quick_search` to find a specific reference company, then browse their screens.
3. **View the actual designs** using `mobbin_get_screen_detail` to fetch full screenshots. Study the layout, spacing, hierarchy, copy, and interaction patterns.
4. **Extract what works** — note the design decisions: how they handle validation, progress indication, empty states, error states, transitions between steps, and information density.
5. **Apply with intent** — don't copy blindly. Understand _why_ a choice was made and adapt it to the current context.

## Available Mobbin MCP Tools

| Tool | Use for |
|------|---------|
| `mobbin_search_apps` | Find apps by category and platform |
| `mobbin_quick_search` | Fast autocomplete search for a specific app by name |
| `mobbin_search_screens` | Search screens by UI pattern, element, or text |
| `mobbin_search_flows` | Search user flows by action type (onboarding, checkout, etc.) |
| `mobbin_get_screen_detail` | Fetch full screenshot of a specific screen |
| `mobbin_get_filters` | Get all available filter values (categories, patterns, elements) |
| `mobbin_popular_apps` | Browse popular apps by category |
| `mobbin_list_collections` | List saved collections |

## Reference Companies

When researching UI patterns, prioritise these companies known for exceptional product design:

- **Attio** — CRM with a clean, modern data-heavy UI. Great for tables, forms, record views, filters.
- **ElevenLabs** — AI voice platform. Strong onboarding flows, settings, API key management.
- **OpenAI** — ChatGPT and platform. Excellent conversational UI, settings, billing flows, API dashboards.
- **Peec AI** — Clean AI product design. Good for minimal flows and modern layouts.
- **Intercom** — Customer messaging. Best-in-class for multi-step workflows, message composers, audience builders.
- **Dub** — Link management. Sharp, minimal UI. Good for dashboards, forms, analytics views.
- **Cursor** — AI code editor. Great for command palettes, settings, onboarding, subscription flows.
- **Midday** — Finance/time tracking. Beautiful data visualisation, clean forms, dashboard layouts.

## What to Look For

When reviewing references, pay attention to:

- **Step indicators** — how progress is shown (numbered steps, progress bars, breadcrumbs, segmented controls)
- **Form layout** — single column vs multi-column, grouping, section headers, inline vs block labels
- **Validation** — inline errors, field-level vs form-level, real-time vs on-submit
- **Empty states** — what users see before data exists, CTAs, illustrations
- **Loading states** — skeletons, spinners, optimistic updates, progressive loading
- **Transitions** — how the UI moves between steps, enter/exit animations, layout shifts
- **Copy & microcopy** — button labels, helper text, error messages, confirmation dialogs
- **Information density** — how much is shown at once vs progressive disclosure
- **Mobile adaptation** — how desktop patterns translate to smaller screens

## Example Usage

When asked to build a multi-step form:

1. Search Mobbin for "stepper" and "multi-step form" screens
2. Search each reference company by name and browse their form/onboarding flows
3. Fetch screenshots of the best examples
4. Identify common patterns (e.g. most use a top progress bar, left-aligned single-column layout, sticky footer with back/next)
5. Note differentiators (e.g. Attio uses inline validation with subtle animations, Intercom groups related fields with section dividers)
6. Build the component incorporating the strongest patterns
