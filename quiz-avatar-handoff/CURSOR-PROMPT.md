# TheCampus: result avatars and role choice

Work in the CURRENT local `/Users/thiyagab/workarea/TheCampus` React + Firebase app (`web`, `admin`, `functions`). Inspect its actual latest quiz/results, scoring, profile saves, authentication and server validation first. Do not target the older remote static site.

## Assets
This package will be in local `quiz-avatar-handoff`, with the six original SVGs beside this prompt. Copy them unchanged into the actual app's appropriate asset location. No substitutions or redraws; preserve existing unique SVG IDs. Map to the app's existing role identifiers:

| Role | Animal | Original file |
|---|---|---|
| Builders | Beaver | builders-beaver.svg |
| Hackers | Fox | hackers-fox.svg |
| Creators | Peacock | creators-peacock.svg |
| Connectors | Dolphin | connectors-dolphin.svg |
| Leaders | Wolf | leaders-wolf.svg |
| Planners | Spider | planners-spider.svg |

## Implementation
- Integrate these avatars into the current results UI. Respect the latest Yellove brand, existing components and styling; no wholesale redesign. Provide meaningful alt text, e.g. “Beaver — Builders”. Roles are friendly discovery starting points, not diagnoses or fixed identities.
- Use existing scoring and returned role identifiers exactly. Do not invent thresholds, reinterpret ties, or change scoring.
- ONE returned role: display its animal and role; confirm the choice through the existing continuation as appropriate.
- EXACTLY TWO returned roles: show two equally clear selectable avatar cards. Student chooses ONE, with no preselected choice for a new result. Use a labelled accessible radio group, keyboard navigation, clear focus/selected states and comfortable touch targets. Continue stays disabled until a choice is made. Support mobile layouts.
- MORE THAN TWO returned roles: respect existing handling; never silently discard arbitrary roles. If existing logic leaves this ambiguous, report it instead of inventing a rule.
- Preserve original suggested roles and scores separately from `selectedRole` (or the existing canonical equivalent). Do not overwrite original results. Persist the chosen role through the existing profile/result save methods and secure server logic, validating it against actual suggestions. Inspect and correctly handle the existing anonymous flow and authenticated flow without weakening authorization or inventing an unrelated login flow.
- Restore an existing saved selection for its result. Refresh must not silently reselect another role or default an unchosen two-role result. Allow changes if the existing flow supports them.
- Expose the persisted chosen role as the basis for a future roadmap via the current data model/continuation contract. Do NOT invent or build roadmap content now.

## Verify and report
Test all six mappings, single-role continuation, two-role selection of either option, no initial selection/disabled Continue, preservation of suggestions/scores, persistence and refresh, existing anonymous/authenticated paths, keyboard accessibility and mobile layout. Check more-than-two handling against existing logic. Use current project test tools; report anything you cannot test.

Do not deploy, merge, auto-commit or perform destructive operations. Report changed files, persistence decisions, test results and unresolved ambiguities.
