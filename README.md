# constraint-inference

Reverse-engineers constraint parameters from user override behavior. When users override captain decisions, this service infers which constraint boundary was wrong and adjusts it.

TypeScript service on port 9439. Polls PLATO for override events, detects patterns, updates the constraint model, and signals the captain to re-deliberate.

## How It Works

```
Captain decides EMERGENCE → User overrides to STABLE
                         ↓
         OverrideEvent recorded in PLATO
                         ↓
         constraint-inference polls PLATO (:8847)
                         ↓
         Maps decision delta → constraint parameter
                         ↓
         Accumulates patterns (rolling window of 20)
                         ↓
         When confidence ≥ 0.75 and samples ≥ 3:
           1. Predict effect (simulation-first)
           2. Update model parameter
           3. Save to disk + PLATO
           4. Signal captain re-deliberation
```

## Install & Run

```bash
npm install
npx ts-node src/index.ts
```

Environment variables:

| Variable | Default | Purpose |
|----------|---------|---------|
| `PLATO_HOST` | `localhost` | PLATO server host |
| `PLATO_PORT` | `8847` | PLATO server port |

## API (port 9439)

### POST /override — Inject an override event

```bash
curl -X POST localhost:9439/override \
  -H 'Content-Type: application/json' \
  -d '{
    "user_id": "casey",
    "graph": {"V": 6, "E": 14, "C": 1},
    "original_decision": "EMERGENCE",
    "user_decision": "STABLE",
    "reason": "this looks stable to me"
  }'
```

Response:

```json
{
  "status": "recorded",
  "patterns_found": 1,
  "significant": true
}
```

### GET /model — Current constraint model

```json
{
  "emergence_beta_threshold": -2,
  "safety_margin": 0.15,
  "trust_min": 0.5,
  "trust_max": 0.95,
  "zhc_tolerance": 0.001,
  "action_confidence_min": 0.7
}
```

### GET /patterns — Detected patterns

Returns all patterns (not just significant ones).

### GET /health — Health check

## Decision Mapping

Four captain decisions, ordered from most to least constrained:

```
CONSTRAINED → STABLE → DECIDED → EMERGENCE
```

When a user overrides, the direction of the override maps to a specific constraint:

| Captain Decision | User Override | Inference | Constraint Updated |
|-----------------|---------------|-----------|-------------------|
| EMERGENCE | STABLE | Emergence too sensitive | `emergence_beta_threshold` |
| STABLE | CONSTRAINED | Safety margin too loose | `safety_margin` |
| DECIDED | STABLE | Action threshold too low | `action_confidence_min` |
| EMERGENCE | CONSTRAINED | Multiple constraints wrong | `emergence_beta_threshold` |
| CONSTRAINED | STABLE | Safety too tight | `safety_margin` |
| CONSTRAINED | DECIDED | Safety too tight | `safety_margin` |
| DECIDED | EMERGENCE | Emergence not sensitive enough | `emergence_beta_threshold` |
| STABLE | DECIDED | Action threshold too high | `action_confidence_min` |

User chose *more constrained* than captain → **tighten**. User chose *less constrained* → **loosen**.

## Constraint Model Parameters

| Parameter | Default | Range | Delta per update |
|-----------|---------|-------|-----------------|
| `emergence_beta_threshold` | -2 | unbounded | ±0.07 |
| `safety_margin` | 0.15 | [0, 1] | ±0.05 |
| `trust_min` | 0.5 | [0, 1] | ±0.05 |
| `trust_max` | 0.95 | [0, 1] | ±0.05 |
| `zhc_tolerance` | 0.001 | ≥ 0 | ±0.0001 |
| `action_confidence_min` | 0.7 | [0, 1] | ±0.05 |

Model is persisted to `~/.config/constraint-inference/model.json`.

## Pattern Detection

Override events go into a rolling window (default: 20 events). The `inferConstraints` function:

1. Maps each event to a `(constraint_id, direction)` pair
2. Groups by `(constraint_id, direction)`
3. Computes confidence: `min(0.95, 0.4 + sample_size × 0.2)`

A pattern is **significant** when:
- `confidence ≥ 0.75` (requires ≥ 2 samples)
- `sample_size ≥ 3`

## Simulation-First Predictions

Before applying an update, a prediction tile is filed to PLATO:

```typescript
{
  constraint_id: "emergence_beta_threshold",
  current_value: -2,
  predicted_value: -1.93,
  expected_direction: "tighten",
  expected_override_reduction_pct: 25,  // tightening → ~25% reduction
  confidence: 0.8,
  lamport: 42
}
```

After enough real override data accumulates, the prediction is confirmed or superseded via PLATO's lifecycle (`active` → `superseded`). Lamport clocks provide causal ordering.

## PLATO Integration

Reads from:
- `GET /room/captain_overrides_history` — historical override events

Writes to:
- `POST /room/constraint_updates` — constraint parameter changes
- `POST /submit` room `constraint_predictions` — simulation-first predictions
- `POST /room/captain_signals` — re-deliberation signals

## Example: End-to-End Flow

1. User overrides captain's EMERGENCE decision to STABLE
2. Override recorded: `{original: EMERGENCE, user: STABLE, graph: {V:6,E:14,C:1}}`
3. Inference maps: EMERGENCE→STABLE = tighten `emergence_beta_threshold`
4. 3 more similar overrides arrive → confidence reaches 0.8
5. Prediction filed: "tightening emergence_beta_threshold by 0.07, expect 25% fewer overrides"
6. Model updated: `emergence_beta_threshold` from -2.0 to -2.07
7. Captain signaled to re-deliberate with new threshold
8. After observation period, prediction confirmed if override rate dropped

## Project Structure

```
src/
├── index.ts                # Main loop + HTTP API (port 9439)
├── types.ts                # Interfaces: OverrideEvent, OverridePattern, MutableConstraintModel
├── constraint_inferrer.ts  # Core inference: map deltas → constraints
├── constraint_model.ts     # Load/save/update model from disk
├── override_tracker.ts     # Rolling window of events, pattern analysis
├── plato_bridge.ts         # Read/write PLATO tiles
├── re_deliberate.ts        # Signal captain to re-run with updated constraints
└── simulation_first.ts     # Predict-apply-observe-confirm cycle
```

## Related Repos

| Repo | Purpose |
|------|--------|
| [`fleet-health-monitor`](https://github.com/SuperInstance/fleet-health-monitor) | Fleet control plane — runs the PLATO server this bridges to |
| [`plato-types`](https://github.com/SuperInstance/plato-types) | Core types — LamportClock, TileLifecycle, content_hash |
| [`agent-field`](https://github.com/SuperInstance/agent-field) | Agent room coordination with coupling and gap detection |
| [`captains-log`](https://github.com/SuperInstance/captains-log) | Oracle1's growth diary — includes constraint theory research |

## License

MIT
