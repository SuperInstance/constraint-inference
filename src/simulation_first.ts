/**
 * Simulation-First Constraint Prediction
 * 
 * Before applying a constraint update inferred from user overrides,
 * predict its effect. After enough data accumulates, confirm or supersede.
 * 
 * The key insight: constraint updates are hypotheses about user preference.
 * We predict the effect, then confirm against real override data.
 * 
 * Pattern: predict → apply → observe → confirm/supersede
 */

import { ConstraintPrediction, MutableConstraintModel, TileLifecycleState } from './types';

// Global Lamport clock for causal ordering
let lamportClock = 0;
function tick(): number { return ++lamportClock; }
function merge(remote: number): number { lamportClock = Math.max(lamportClock, remote) + 1; return lamportClock; }

// Active predictions awaiting confirmation
const activePredictions: Map<string, ConstraintPrediction> = new Map();

/**
 * Predict the effect of a constraint update before applying it.
 * 
 * @param constraint_id Which constraint parameter
 * @param current Current value
 * @param proposed New value
 * @param direction Tightening or loosening
 * @param confidence How confident we are based on override patterns
 * @returns A prediction tile to file to PLATO
 */
export function predictConstraintEffect(
  constraint_id: string,
  current: number,
  proposed: number,
  direction: 'tighten' | 'loosen',
  confidence: number,
): ConstraintPrediction {
  const prediction: ConstraintPrediction = {
    constraint_id,
    current_value: current,
    predicted_value: proposed,
    expected_direction: direction,
    // Heuristic: tighter constraints should reduce overrides by ~20-40%
    // Looser constraints should reduce overrides by ~10-30%
    expected_override_reduction_pct: direction === 'tighten' ? 25 : 15,
    confidence,
    t_minus_event: `T-1h: monitoring override rate after ${constraint_id} update`,
    lamport: tick(),
    confirmed: false,
  };
  
  activePredictions.set(constraint_id, prediction);
  return prediction;
}

/**
 * Confirm a prediction against actual override data.
 * 
 * @param constraint_id Which constraint was updated
 * @param override_rate_before Override rate before update
 * @param override_rate_after Override rate after update
 * @returns Whether prediction was confirmed
 */
export function confirmPrediction(
  constraint_id: string,
  override_rate_before: number,
  override_rate_after: number,
): { confirmed: boolean; prediction: ConstraintPrediction | null } {
  const prediction = activePredictions.get(constraint_id);
  if (!prediction) {
    return { confirmed: false, prediction: null };
  }
  
  if (override_rate_before === 0) {
    // No baseline data — can't confirm
    return { confirmed: false, prediction };
  }
  
  const actual_reduction = ((override_rate_before - override_rate_after) / override_rate_before) * 100;
  
  // Confirmation: actual reduction is in the right direction and meaningful (>5%)
  const confirmed = actual_reduction > 5 && (
    (prediction.expected_direction === 'tighten' && override_rate_after < override_rate_before) ||
    (prediction.expected_direction === 'loosen' && override_rate_after < override_rate_before)
  );
  
  prediction.confirmed = true;
  prediction.actual_override_reduction_pct = actual_reduction;
  
  if (confirmed) {
    activePredictions.delete(constraint_id);
  }
  
  return { confirmed, prediction };
}

/**
 * Get all pending predictions (not yet confirmed).
 */
export function getPendingPredictions(): ConstraintPrediction[] {
  return Array.from(activePredictions.values()).filter(p => !p.confirmed);
}

/**
 * Lamport clock operations for causal ordering.
 */
export function getLamportClock(): number { return lamportClock; }
export function mergeLamport(remote: number): number { return merge(remote); }
