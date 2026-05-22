/**
 * FleetGraph - simplified graph representation
 */
export interface FleetGraph {
    V: number;
    E: number;
    C: number;
}
/**
 * Captain decision states
 */
export type CaptainDecision = 'EMERGENCE' | 'STABLE' | 'CONSTRAINED' | 'DECIDED';
/**
 * Decision delta - captures the direction of override
 */
export interface DecisionDelta {
    captain: CaptainDecision;
    user: CaptainDecision;
}
/**
 * Override event logged by the system
 */
export interface OverrideEvent {
    timestamp: number;
    user_id: string;
    graph: FleetGraph;
    original_decision: CaptainDecision;
    user_decision: CaptainDecision;
    reason?: string;
}
/**
 * A detected pattern in override behavior
 */
export interface OverridePattern {
    constraint_id: string;
    direction: 'tighten' | 'loosen';
    confidence: number;
    sample_size: number;
    evidence: OverrideEvent[];
}
/**
 * The mutable constraint model that gets updated based on inference
 */
export interface MutableConstraintModel {
    emergence_beta_threshold: number;
    safety_margin: number;
    trust_min: number;
    trust_max: number;
    zhc_tolerance: number;
    action_confidence_min: number;
}
export declare const DEFAULT_MODEL: MutableConstraintModel;
//# sourceMappingURL=types.d.ts.map