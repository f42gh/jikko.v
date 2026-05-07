# jikko Design 01

## Document Role

This document is the first implementation blueprint for jikko v1.

Its goals are:

- protect the product core
- reconsider the tech stack as a whole
- make implementation order and responsibilities explicit
- define a foundation that can grow without collapsing

## Reconfirming the Assumptions

jikko operates under assumptions that differ significantly from a typical SaaS todo app.

- There will be a single user for the foreseeable future.
- Authentication is unnecessary.
- Data should be stored locally.
- The highest-value outcome is reduced cognitive load.
- The product is not centered on task storage, but on deciding what should be done now.
- The product scope includes task decomposition, prioritization, start support, completion reward, and ROI visibility.

If these assumptions are taken seriously, the earlier `Next.js + Clerk + hosted DB` direction is heavier than v1 requires.

## Reconsidered Conclusion

The best v1 starting point is a `local-first desktop application`.

Recommended stack:

- Runtime: `Tauri`
- Frontend: `React` + `TypeScript` + `Vite`
- UI: `Tailwind CSS`
- Local database: `SQLite`
- Database access: `Drizzle ORM`
- State management: `Zustand`
- Forms: `React Hook Form` + `Zod`
- Charts: `Recharts`
- Unit/integration testing: `Vitest`
- E2E testing: `Playwright`
- Priority engine: deterministic rule-based logic implemented in TypeScript
- AI: optional in v1, never used for authoritative prioritization
- Optional analysis helper: Python subprocess invoked from Tauri on refresh

## Why This Conclusion

### Why Tauri instead of Next.js

`Next.js` is strong for web products, but it introduces avoidable friction for jikko v1.

- It tends to pull the project toward web-service assumptions even though auth is unnecessary.
- Using a local database naturally often requires a local server or awkward architecture.
- Distribution and persistence are less direct for a single-user personal application.

`Tauri` fits more naturally because it allows:

- direct use of local SQLite
- a personal app model without auth
- easier future support for local notifications and file export
- a standard React/TypeScript UI workflow

### Why SQLite

`SQLite` matches the current product assumptions well.

- It is excellent for single-user applications.
- Setup is minimal.
- Backup and migration thinking stays simple.
- It is fully capable of handling tasks, scores, history, and event logs for v1.

`PostgreSQL` can be reconsidered later if cloud sync or multi-device access becomes a real product need.

### Why Drizzle instead of Prisma

`Prisma` is workable, but `Drizzle` is a better fit for this v1.

- It stays closer to SQLite.
- It keeps the stack lighter.
- Schema and SQL remain easier to reason about.
- It feels more natural inside a local application.

For this MVP, ease of local operation matters more than a higher-level ORM abstraction.

## Design Principles

The product should follow these principles:

1. Do not make the user think more than necessary.
2. Priority decisions must be explainable.
3. Core logic must not be delegated to AI.
4. Starting tasks matters more than collecting tasks.
5. Completion should produce a strong sense of reward.
6. Every feature should strengthen the core loop.

## Core Loop for v1

The main loop for v1 is:

1. Add a task.
2. Decompose it into executable minimum units.
3. Capture the structured factors needed for evaluation.
4. Score tasks and choose a single best next action.
5. Show why that task should be done now.
6. Make starting easy.
7. Record completion and return reward plus progress.
8. Use history to show ROI and growth.

## System Structure

v1 should be a modular monolith in a single repository.

Proposed structure:

- `app`
  - screens, routing, UI components
- `domain/tasks`
  - tasks, decomposition, dependency relations, status transitions
- `domain/scoring`
  - priority calculation, explanation generation, ROI estimation
- `domain/behavior`
  - start support, reward design, completion feedback
- `domain/history`
  - completion history, streaks, reflection inputs
- `domain/planning`
  - daily recommendation, next-action selection, reevaluation
- `domain/analysis`
  - estimation gap diagnostics, helper-process handoff, analysis suggestions
- `infra/db`
  - SQLite, migrations, repositories
- `infra/system`
  - Tauri integration, notifications, file import/export, helper-process invocation

## Analysis Helper Process

The analysis layer can become more compute-heavy than the core scoring loop.

To keep v1 light without blocking future experimentation, jikko may invoke an optional `Python` helper process from `Tauri` only when analysis is refreshed.

Rules:

- core prioritization remains deterministic in TypeScript
- Python is limited to secondary analysis, diagnostics, and future scheduling experiments
- the helper process is request/response, not a permanent realtime backend
- if the helper is unavailable, the TypeScript analysis path remains the fallback

This preserves the local-first simplicity while leaving room for `pandas`, `numpy`, and future ROI or scheduling experiments.

## Screen Design Basics

Do not create too many screens.

Primary v1 screens:

1. `Now`
   - the highest-priority screen, showing exactly one recommended task
2. `Inbox`
   - a place to add tasks and break them down
3. `Plan`
   - a view of today's candidates and why they rank as they do
4. `History`
   - completion history, streaks, ROI, and perceived rewards
5. `Settings`
   - only minimal controls such as weights and backup settings

`Now` is the most important screen.

It should prioritize:

- one clearly recommended task
- a short, convincing rationale
- an obvious action to start
- a natural next step after completion

## Data Model

The main v1 tables should be:

### tasks

- id
- title
- description
- status
- parent_task_id
- effort_estimate
- urgency
- impact
- penalty_of_delay
- momentum_gain
- emotional_resistance
- energy_required
- due_at
- created_at
- updated_at

### task_score_snapshots

- id
- task_id
- priority_score
- expected_roi
- score_breakdown_json
- why_now_summary
- created_at

### task_events

- id
- task_id
- event_type
- payload_json
- created_at

Expected `event_type` values:

- created
- decomposed
- recommended
- started
- completed
- skipped
- snoozed

### daily_recommendations

- id
- date
- recommended_task_id
- rationale_json
- created_at

### reward_records

- id
- task_id
- reward_type
- reward_value
- note
- created_at

### reflections

- id
- task_id
- actual_benefit
- perceived_difficulty
- confidence_gain
- memo
- created_at

## Scoring Design

Scoring is the center of v1.

It should not be handed to AI.

Input factors:

- urgency
- impact
- penalty_of_delay
- momentum_gain
- effort_estimate
- emotional_resistance
- energy_required
- proximity of `due_at`

Outputs:

- `priority_score`
- `expected_roi`
- `why_now_summary`

Rules:

- scoring must be deterministic
- factors should be understandable to the user
- rationale text should be derived from score breakdowns
- both "loss of delay" and "benefit of acting now" should be visible

Example initial formula:

```ts
priority =
  urgency * 0.25 +
  impact * 0.25 +
  penaltyOfDelay * 0.20 +
  momentumGain * 0.15 -
  effortEstimate * 0.10 -
  emotionalResistance * 0.05;
```

This is not final. It is an intentionally simple baseline that is easy to test and tune.

## AI Usage

AI should not make core decisions in v1.

Acceptable uses:

- rewriting task wording
- suggesting decomposition ideas
- drafting reflection text after completion
- smoothing explanation phrasing

Unacceptable uses:

- final priority decisions
- black-box scoring
- empty motivational language without evidence

The reason is simple: jikko's value depends on trustworthy prioritization.

## State Management

State should be separated into three layers:

1. Persistent state
   - tasks, history, scores, settings stored in SQLite
2. Session state
   - selected task, in-progress decomposition, UI mode
3. Derived state
   - best next task, ranking results, display summaries

`Zustand` should be used for session and derived state.

The database should remain the single source of truth for persisted data.

## Non-Functional Requirements

v1 should satisfy these requirements:

- fast startup
- full offline operation
- easy local backup
- reproducible score calculation
- easy schema migration
- preference for immediacy over page-heavy flows

## What v1 Should Not Do

These items should be explicitly deferred:

- multi-user support
- account management
- cloud sync
- mobile-native apps
- real-time collaboration
- black-box AI prioritization
- complex notification rule engines

## Implementation Order

### Phase 1: Foundation

- bootstrap Tauri + React + TypeScript
- add Tailwind
- initialize SQLite + Drizzle
- create basic routing

### Phase 2: Core Data

- build `tasks`
- build `task_events`
- build `task_score_snapshots`
- implement basic CRUD
- implement task decomposition

### Phase 3: Priority Engine

- implement scoring functions
- show score breakdowns
- build the `Now` screen
- generate rationale summaries

### Phase 4: Behavior Support

- add start actions
- record start/completion events
- add reward feedback on completion
- connect completion to the next recommended action

### Phase 5: History and ROI

- build the `History` screen
- show streaks
- show completion trends
- visualize ROI

### Phase 6: Supporting Features

- local notifications
- backup/export
- experimental AI assistance

## The Largest Design Decision

The biggest decision from this reconsideration is:

`jikko should not start as a SaaS product; it should start as a local personal application`

That choice simplifies the system materially:

- auth disappears
- hosted DB disappears
- external analytics dependencies disappear
- implementation can focus on the product core

## What This Design Lets Us Validate

This design keeps the team focused on the questions that actually matter for v1:

- Will the user trust the recommended next task?
- Does task decomposition improve initiation rate?
- Does the rationale create conviction?
- Does the reward design improve continuation?
- Does ROI visibility rebuild confidence?

If these questions are answered well, web distribution, sync, and multi-user support can be considered later.

## Final Decision

The v1 stack should be:

- Runtime: `Tauri`
- UI: `React` + `TypeScript` + `Vite` + `Tailwind CSS`
- Database: `SQLite`
- DB layer: `Drizzle ORM`
- Validation: `Zod`
- State management: `Zustand`
- Charts: `Recharts`
- Testing: `Vitest` + `Playwright`
- Prioritization: deterministic rule-based logic
- AI: auxiliary use only

This is the most coherent technical direction for jikko as currently defined.
