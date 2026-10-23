# AGENTS.md

Behavioral guidelines to reduce common LLM coding mistakes and enforce strict quality standards.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

---

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

---

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: *"Would a senior engineer say this is overcomplicated?"* If yes, simplify.

---

## 3. Surgical Changes & Style vs. Anti-Pattern Distinction

**Touch only what you must. Clean up only your own mess. Never propagate broken patterns.**

When editing existing code:
- Don't touch or refactor unrelated code that isn't broken.
- When your changes create orphans: remove imports/variables/functions that YOUR changes made unused.
- The test: Every changed line should trace directly to the user's request.

### Style (Syntax) vs. Anti-Pattern (Technical Flaw) Distinction
The "match existing style" rule is NEVER an excuse to mimic outdated architecture or propagate anti-patterns:

1. **Style & Preference (MATCH THE EXISTING FILE):**
   - Follow the existing file's subjective choices that do not harm correctness or performance:
     - Naming conventions (`camelCase`, `PascalCase`), function declarations vs. arrow functions (`function` vs `const () =>`), import ordering.
     - Never impose arbitrary personal syntax preferences onto the codebase.
2. **Flaws & Anti-Patterns (NEVER MIMIC OR COPY):**
   - Measurable defects are technical debt, not "style choices":
     - Unnecessary re-render cascades, excessive component-level state, deprecated/removed APIs, N+1 or unindexed database queries, security/authorization oversights.
     - *"The existing file does it this way"* is NEVER a valid reason to replicate bad patterns into new code.
3. **The Broken Window Rule (Stop & Ask):**
   - If adding a feature requires building directly on top of an existing anti-pattern: do not expand the broken window. Stop. Surface the architectural flaw and the modern alternative to the user, and ask for confirmation.

---

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests and builds pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

---

## 5. Strict Guardrails & Core Operating Principles

### Project Purpose & Core Approach
- **Boilerplate Flexibility:** This repo is a boilerplate designed to quickly adapt and deliver e-commerce storefronts for clients. Never treat current store sample data as universal truth; adapt it freely to client requirements.
- **Freedom to Make Breaking Changes:** The store is not live or used by real users yet. Do not hesitate to introduce breaking changes.
- **Backwards Compatibility is STRICTLY FORBIDDEN:** Never add backwards compatibility hacks or redirect workarounds. Directly delete and clean up obsolete/unused code and routes.

### Execution & Senior Engineering Protocol
- **Sequential Task Completion:** Never move on to another task before finishing the current one. If given multiple tasks, complete them strictly in sequence; do not start the next task until the current one is fully completed (code + verification).
- **ALWAYS Use `/ponytail` Skill:** Avoid over-engineering, unnecessary dependencies, and speculative abstractions.
- **ALWAYS Apply `/i-have-adhd` Skill:** Always shape output for an ADHD reader: lead with the next concrete action, number multi-step work, state progress clearly, suppress tangents, provide specific time estimates, and make completed wins visible.
- **Simplicity First (KISS & YAGNI):** Always choose the simplest, most direct solution; avoid complex mechanisms and unnecessary conditional branching. Do not turn logic solvable in a few lines into complicated machinery.
- **Surgical Changes:** Before writing code, aim for the most minimal, surgical, and error-free solution; avoid abstractions or helper utilities for single-use code.
- **Honor Contracts and Types:** Do not break existing architecture, contracts, or type definitions; read and verify the relevant files instead of making assumptions.
- **Direct & Unslop Communication:** Keep explanations concise. Avoid AI jargon, filler commentary, and fluff; focus directly on clean, purpose-driven code.

### Strict Technical & Architectural Prohibitions
- **Writing Test Files is STRICTLY FORBIDDEN:** Do not create test files (`.test.ts`, `.spec.ts`, etc.), do not install test libraries, and do not write test code in this project.
- **`useMemo` and `useCallback` are STRICTLY FORBIDDEN:** Manual memoization is completely forbidden due to Next.js and Cache Components architecture.
- **Barrel Exports (Re-exports) are FORBIDDEN:** Import components and modules directly from their source files; never use index re-export files (`index.ts`).
- **Passthrough / Trampoline Wrappers are FORBIDDEN:** Never create intermediate wrappers whose sole purpose is forwarding props/arguments to another function or component; call the underlying function or component directly.
- **Non-Functional / Empty UI Elements are FORBIDDEN:** Every letter, word, button, div, card, and UI component shown to the user must serve a concrete purpose and function. Never add empty decorative elements, filler copy, or non-functional widgets; everything displayed must provide clear user value.

### Operational Safety & Git Rules
- **Destructive Git Commands are FORBIDDEN:** Never run commands like `git checkout`, `git add -u`, or anything that blindly affects the entire workspace.
- **Dangerous Git Commands are FORBIDDEN:** Never execute `git push` or `git reset --hard`.
- **Unnecessary Builds / Type Checks are FORBIDDEN:** Never run `npm run build` or `npx tsc` unnecessarily. Only run checks when TypeScript/JavaScript source code was actually modified and requires verification, or when the user explicitly requests it.
- **Convex Production Protection:** Never perform operations against the Convex Production environment without explicit user confirmation.

## 6. Next.js 16 Rules & Strict Prohibitions (NEVER DO)

### 1. Synchronous Request API Access Is Strictly Forbidden
- `params` and `searchParams` are Promises. Never read `params.id` or `searchParams.q` synchronously. Always use `await props.params` and `await props.searchParams` (or `use(params)` in Client Components).
- `cookies()`, `headers()`, and `draftMode()` are Promises. Never call `cookies().get()` synchronously; always use `(await cookies()).get()`.
- Route metadata and generation functions (`generateMetadata`, `opengraph-image`, `icon`, `sitemap`) receive parameters as Promises (`await params`, `await id`).

### 2. Server Action Security Violations Are Strictly Forbidden
- Never rely on page-level auth or redirect checks to guard Server Actions. Server Actions are independent, public POST endpoints; every action must self-authenticate (`auth()`) and verify resource ownership (authorization/IDOR prevention).
- Never trust client-supplied user IDs or object payloads; always resolve the acting identity directly from the authenticated session.
- Never return raw database records to the client; return only the minimal DTO fields required by the UI.
- Never attempt to run Server Actions in parallel using `Promise.all` on the client; the action dispatcher serializes executions.

### 3. Usage of Deprecated or Removed APIs Is Forbidden
- `middleware.ts` is now `proxy.ts` (exported function named `proxy`). Edge runtime is not supported in `proxy`; runtime is `nodejs`.
- `next/legacy/image` and `images.domains` are removed. Use `next/image` with `images.remotePatterns`.
- `priority` on images is removed; use `preload={true}` on LCP elements.
- `@deprecated FormEvent` is forbidden in form handlers; use React 19 standard `React.SubmitEvent<HTMLFormElement>`.
- `next lint` and the `eslint` key in `next.config` are removed; run `eslint` directly.
- `serverRuntimeConfig` and `publicRuntimeConfig` are removed; access `process.env` and `NEXT_PUBLIC_*` directly.
- `unstable_cacheLife` and `unstable_cacheTag` prefixes are removed; import `cacheLife` and `cacheTag` directly.
- `revalidateTag(tag)` requires an explicit profile (`revalidateTag(tag, 'max')`). To immediately update client UI inside Server Actions, use `updateTag(tag)`.
- `experimental_ppr`, `experimental.dynamicIO`, and `experimental.useCache` are removed; use top-level `cacheComponents: true`.

### 4. Fetch & Caching Violations Are Forbidden
- Next.js 15+ does NOT cache `fetch()` requests by default (`no-store`). Never assume automatic caching. If caching is needed, explicitly specify `{ cache: 'force-cache' }` or `'use cache'`.
- Route handler `GET` requests are dynamic by default; if static caching is desired, export `export const dynamic = 'force-static'`.
- Parallel route slots (`@slot`) must include a `default.tsx` file; otherwise builds will fail.

---

## 7. Design System

This project's design system and component library is documented in `docs/design-system.md`. It serves as the source of truth for color tokens, typography, spacing, radius, and components. Always consult `docs/design-system.md` before designing or building any UI.

---

## 8. UI/UX Anti-Slop & Strict Aesthetic Guardrails (NEVER DO)

Reject all generic AI-generated landing page tropes, Vercel-core template clichés, and gimmicky design slop. The following patterns are strictly forbidden:

### 1. Forbidden Visual & Layout Clichés
- **NO Bento Grids:** Do not build trendy, asymmetric "bento box" feature grids. Use structured, purposeful layouts tailored to the actual domain and content.
- **NO Generic Feature Cards in a Row:** Never output formulaic 3-column rows of identical cards featuring a centered icon, bold title, and two lines of filler text.
- **NO Lucide Icon Clichés:** Never scatter generic, uncontextualized Lucide icons as visual filler or bullet point replacements.
- **NO Sparkle Icons:** Never use sparkle/magic icons (`Sparkles`, `✨`, stars) to signify AI, smart features, or modern capabilities.
- **NO Liquid Glass / Excessive Glassmorphism:** Avoid blurry frosted glass overlays (`backdrop-blur-md`, semi-transparent liquid borders, glassy cards) that compromise contrast and readability.
- **NO Background Orbs & Radial Glows:** Do not place floating blurred colored orbs (`bg-gradient-radial`, glowing ambient spheres) behind text or headers.
- **NO Dot Grid / Mesh Backgrounds:** Do not use repetitive SVG/CSS dot grid matrix patterns or wireframe grid backgrounds.
- **NO Rainbow / Chromatic Coloring:** Never use multi-stop rainbow gradients, iridescent borders, or multi-colored chromatic text effects. Stick strictly to the defined brand palette in `docs/design-system.md`.

### 2. Forbidden Typography & Copy Slop
- **NO Overused AI Fonts:** Do NOT default to generic, overused AI aesthetic typefaces (`Inter`, `Geist`, `Space Grotesk`). Follow the project's design system fonts.
- **NO Emojis in UI or Headings:** Never use emojis (🚀, 💡, ⚡, 🔥) in headings, badges, buttons, cards, or feature lists.
- **NO Em Dashes in Copy:** Never use em dashes (`—`) in titles, microcopy, or marketing copy.
- **NO AI Contrasting Copy Formulas:** Never write cliché "It's not X, it's Y" or "Not just an A, but a B" contrasting marketing tropes.

### 3. Forbidden Micro-Interactions & Motion
- **NO Useless Hover Animations:** Avoid gimmicky 3D tilts, magnetic button effects, excessive scaling (`scale-105`), bouncing, or floating card transitions that add no usability value.
- **NO Animated / Bouncing Arrows:** Never use constantly bouncing chevron or arrow indicators on CTAs, links, or scroll prompts.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
