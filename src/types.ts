/**
 * FleetGraph - simplified graph representation
 */
export interface FleetGraph {
  V: number;  // vertices (agents)
  E: number;  // edges (connections)
  C: number;  // components (clusters)
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
  emergence_beta_threshold: number;  // relative to V - 2
  safety_margin: number;            // 0.0 - 1.0
  trust_min: number;                // 0.0 - 1.0
  trust_max: number;                // 0.0 - 1.0
  zhc_tolerance: number;            // small positive
  action_confidence_min: number;    // 0.0 - 1.0
}

export const DEFAULT_MODEL: MutableConstraintModel = {
  emergence_beta_threshold: -2,
  safety_margin: 0.15,
  trust_min: 0.5,
  trust_max: 0.95,
  zhc_tolerance: 0.001,
  action_confidence_min: 0.7,
};
