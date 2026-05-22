/**
 * Constraint Inferrer
 *
 * Maps override decision deltas to constraint parameter updates.
 * This is the core inference algorithm that reverse-engineers what
 * constraint parameter the user thinks is wrong based on their overrides.
 */
import { DecisionDelta, OverrideEvent, OverridePattern } from './types';
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
export declare function mapToConstraintPattern(delta: DecisionDelta): {
    constraint_id: string;
    direction: 'tighten' | 'loosen';
} | null;
/**
 * Merge overlapping patterns (same constraint_id + direction) and compute confidence
 */
export declare function mergePatterns(partials: {
    constraint_id: string;
    direction: 'tighten' | 'loosen';
    event: OverrideEvent;
}[]): OverridePattern[];
/**
 * Infer constraint patterns from a list of override events
 */
export declare function inferConstraints(events: OverrideEvent[]): OverridePattern[];
/**
 * Check if a pattern meets the threshold for triggering a model update
 */
export declare function isSignificant(pattern: OverridePattern, confidenceThreshold?: number, minSamples?: number): boolean;
//# sourceMappingURL=constraint_inferrer.d.ts.map