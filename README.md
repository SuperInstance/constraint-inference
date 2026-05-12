# constraint-inference

[![CI](https://github.com/SuperInstance/constraint-inference/actions/workflows/ci.yml/badge.svg)](https://github.com/SuperInstance/constraint-inference/actions/workflows/ci.yml)

**Reverse-engineers constraint parameters from user override patterns.**

When a captain agent makes a decision (EMERGENCE, STABLE, CONSTRAINED, DECIDED) and the user overrides it, that override contains information about where the constraint boundary *actually* is. This service extracts that information.

## The Core Insight

Every user override is a constraint signal. When the captain says "EMERGENCE" and the user says "STABLE", the user is telling us the emergence threshold was too sensitive. This service maps that delta to a constraint parameter update.

```
Captain says: EMERGENCE
User says:    STABLE
→ User thinks emergence was too sensitive → tighten threshold

Captain says: STABLE  
User says:    CONSTRAINED
→ User thinks safety margin too tight → loosen margin
```

## Architecture

```
src/
├── types.ts              — FleetGraph, DecisionDelta, OverrideEvent
├── override_tracker.ts   — Logs override events with fleet context
├── constraint_inferrer.ts — Maps deltas to constraint updates
├── constraint_model.ts   — Constraint parameter model
├── re_deliberate.ts      — Re-deliberation: should we revisit a decision?
├── plato_bridge.ts       — Push inferred constraints to PLATO
└── index.ts              — Main loop (1-minute poll)
```

### Decision Ordering

Decisions are ordered from most constrained to most permissive:

```
CONSTRAINED → STABLE → DECIDED → EMERGENCE
```

When the user picks a more constrained decision than the captain, they're tightening. When they pick less constrained, they're loosening.

### Override Patterns

The system detects patterns in overrides:
- **Frequency**: How often the user overrides a particular constraint
- **Direction**: Consistently tightening or loosening
- **Context**: Which fleet graph states trigger overrides

These patterns crystallize into constraint parameter updates that feed back into the captain's decision model.

### PLATO Bridge

Inferred constraints are pushed to PLATO rooms so other fleet agents can learn from the user's corrections. The system becomes more aligned over time without explicit configuration.

## Usage

```bash
npm install
npm start
```

The service polls every 60 seconds for new override events, runs inference, and pushes updates to PLATO.

## Why This Matters

Most constraint systems have static thresholds. This one *learns* from the user. Every override makes the system smarter. The constraint boundaries converge to match the user's actual preferences.

This is a form of **inverse reinforcement learning** — but instead of learning a reward function, we're learning constraint boundaries directly from human corrections.

## Ecosystem

Part of the [constraint theory ecosystem](https://github.com/SuperInstance/constraint-theory-ecosystem):

- **constraint-theory-core** — Rust constraint math library
- **dodecet-encoder** — 12-bit constraint state encoding
- **holonomy-consensus** — Fleet consensus protocol
- **intent-inference** — Complementary: infers intent, this infers constraints
- **flux-lucid** — Intent vectors and navigation

## License

MIT
