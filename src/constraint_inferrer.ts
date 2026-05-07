/**
 * Constraint Inferrer
 * 
 * Maps override decision deltas to constraint parameter updates.
 * This is the core inference algorithm that reverse-engineers what
 * constraint parameter the user thinks is wrong based on their overrides.
 */

import { DecisionDelta, OverrideEvent, OverridePattern, CaptainDecision } from './types';

/**
 * Decision ordering (most constrained to least constrained)
 * Higher index = more permissive
 */
const DECISION_ORDER: CaptainDecision[] = ['CONSTRAINED', 'STABLE', 'DECIDED', 'EMERGENCE'];

/**
 * Map a decision delta to the constraint parameter that likely caused it.
 * 
 * The core insight: when the user overrides captain's decision, they're telling us
 * they think the underlying constraint boundary is wrong.
 * 
 * - captain=EMERGENCE, user=STABLE → user thinks emergence was too sensitive → tighten threshold
 * - captain=STABLE, user=CONSTRAINED → user thinks safety margin too tight → loosen margin
 * - captain=DECIDED, user=STABLE → user thinks action threshold too low → tighten threshold
 */
export function mapToConstraintPattern(delta: DecisionDelta): { constraint_id: string; direction: 'tighten' | 'loosen' } | null {
  const captainIdx = DECISION_ORDER.indexOf(delta.captain);
  const userIdx = DECISION_ORDER.indexOf(delta.user);
  
  // Skip if either decision not recognized
  if (captainIdx === -1 || userIdx === -1) {
    return null;
  }
  
  // User chose MORE constrained than captain suggested = tightening
  // User chose LESS constrained than captain suggested = loosening
  const userIsMoreConstrained = userIdx < captainIdx;
  const direction: 'tighten' | 'loosen' = userIsMoreConstrained ? 'tighten' : 'loosen';
  
  // Map the delta to which constraint parameter
  if (delta.captain === 'EMERGENCE' && delta.user === 'STABLE') {
    return { constraint_id: 'emergence_beta_threshold', direction };
  }
  if (delta.captain === 'STABLE' && delta.user === 'CONSTRAINED') {
    return { constraint_id: 'safety_margin', direction };
  }
  if (delta.captain === 'DECIDED' && delta.user === 'STABLE') {
    return { constraint_id: 'action_confidence_min', direction };
  }
  if (delta.captain === 'EMERGENCE' && delta.user === 'CONSTRAINED') {
    // Big jump - could be multiple constraints
    return { constraint_id: 'emergence_beta_threshold', direction };
  }
  if (delta.captain === 'STABLE' && delta.user === 'DECIDED') {
    return { constraint_id: 'action_confidence_min', direction };
  }
  if (delta.captain === 'CONSTRAINED' && delta.user === 'STABLE') {
    return { constraint_id: 'safety_margin', direction };
  }
  if (delta.captain === 'CONSTRAINED' && delta.user === 'DECIDED') {
    return { constraint_id: 'safety_margin', direction };
  }
  if (delta.captain === 'DECIDED' && delta.user === 'EMERGENCE') {
    return { constraint_id: 'emergence_beta_threshold', direction };
  }
  
  return null;
}

/**
 * Merge overlapping patterns (same constraint_id + direction) and compute confidence
 */
export function mergePatterns(partials: { constraint_id: string; direction: 'tighten' | 'loosen'; event: OverrideEvent }[]): OverridePattern[] {
  const map = new Map<string, { direction: 'tighten' | 'loosen'; events: OverrideEvent[] }>();
  
  for (const p of partials) {
    const key = `${p.constraint_id}:${p.direction}`;
    if (!map.has(key)) {
      map.set(key, { direction: p.direction, events: [] });
    }
    map.get(key)!.events.push(p.event);
  }
  
  const patterns: OverridePattern[] = [];
  
  for (const [key, value] of map) {
    const [constraint_id] = key.split(':');
    const sampleSize = value.events.length;
    // Confidence increases with sample size, capped at 0.95
    const confidence = Math.min(0.95, 0.4 + (sampleSize * 0.2));
    
    patterns.push({
      constraint_id,
      direction: value.direction,
      confidence,
      sample_size: sampleSize,
      evidence: value.events,
    });
  }
  
  return patterns;
}

/**
 * Infer constraint patterns from a list of override events
 */
export function inferConstraints(events: OverrideEvent[]): OverridePattern[] {
  const partials: { constraint_id: string; direction: 'tighten' | 'loosen'; event: OverrideEvent }[] = [];
  
  for (const event of events) {
    const delta: DecisionDelta = {
      captain: event.original_decision,
      user: event.user_decision,
    };
    
    const mapped = mapToConstraintPattern(delta);
    if (mapped) {
      partials.push({
        constraint_id: mapped.constraint_id,
        direction: mapped.direction,
        event,
      });
    }
  }
  
  return mergePatterns(partials);
}

/**
 * Check if a pattern meets the threshold for triggering a model update
 */
export function isSignificant(pattern: OverridePattern, confidenceThreshold = 0.75, minSamples = 3): boolean {
  return pattern.confidence >= confidenceThreshold && pattern.sample_size >= minSamples;
}
