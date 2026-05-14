import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MODEL,
  type MutableConstraintModel,
  type OverrideEvent,
  type OverridePattern,
  type FleetGraph,
  type ConstraintPrediction,
  type LifecycleConstraintUpdate,
  type TileLifecycleState,
  type CaptainDecision,
  type DecisionDelta,
} from '../src/types';

describe('types', () => {
  describe('DEFAULT_MODEL', () => {
    it('has all required fields', () => {
      expect(DEFAULT_MODEL).toHaveProperty('emergence_beta_threshold');
      expect(DEFAULT_MODEL).toHaveProperty('safety_margin');
      expect(DEFAULT_MODEL).toHaveProperty('trust_min');
      expect(DEFAULT_MODEL).toHaveProperty('trust_max');
      expect(DEFAULT_MODEL).toHaveProperty('zhc_tolerance');
      expect(DEFAULT_MODEL).toHaveProperty('action_confidence_min');
    });

    it('has numeric values in expected ranges', () => {
      expect(typeof DEFAULT_MODEL.emergence_beta_threshold).toBe('number');
      expect(DEFAULT_MODEL.safety_margin).toBeGreaterThan(0);
      expect(DEFAULT_MODEL.safety_margin).toBeLessThanOrEqual(1);
      expect(DEFAULT_MODEL.trust_min).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_MODEL.trust_min).toBeLessThanOrEqual(1);
      expect(DEFAULT_MODEL.trust_max).toBeGreaterThan(DEFAULT_MODEL.trust_min);
      expect(DEFAULT_MODEL.trust_max).toBeLessThanOrEqual(1);
      expect(DEFAULT_MODEL.zhc_tolerance).toBeGreaterThan(0);
      expect(DEFAULT_MODEL.action_confidence_min).toBeGreaterThan(0);
      expect(DEFAULT_MODEL.action_confidence_min).toBeLessThanOrEqual(1);
    });

    it('matches specific default values', () => {
      expect(DEFAULT_MODEL.emergence_beta_threshold).toBe(-2);
      expect(DEFAULT_MODEL.safety_margin).toBe(0.15);
      expect(DEFAULT_MODEL.trust_min).toBe(0.5);
      expect(DEFAULT_MODEL.trust_max).toBe(0.95);
      expect(DEFAULT_MODEL.zhc_tolerance).toBe(0.001);
      expect(DEFAULT_MODEL.action_confidence_min).toBe(0.7);
    });
  });

  describe('OverrideEvent', () => {
    it('can construct a valid override event', () => {
      const event: OverrideEvent = {
        timestamp: Date.now(),
        user_id: 'casey',
        graph: { V: 6, E: 14, C: 1 },
        original_decision: 'EMERGENCE',
        user_decision: 'STABLE',
        reason: 'Too many agents',
      };
      expect(event.user_id).toBe('casey');
      expect(event.graph.V).toBe(6);
      expect(event.original_decision).toBe('EMERGENCE');
      expect(event.user_decision).toBe('STABLE');
      expect(event.reason).toBe('Too many agents');
    });

    it('allows reason to be undefined', () => {
      const event: OverrideEvent = {
        timestamp: Date.now(),
        user_id: 'casey',
        graph: { V: 3, E: 5, C: 1 },
        original_decision: 'DECIDED',
        user_decision: 'CONSTRAINED',
      };
      expect(event.reason).toBeUndefined();
    });
  });

  describe('OverridePattern', () => {
    it('can construct a valid override pattern', () => {
      const pattern: OverridePattern = {
        constraint_id: 'emergence_beta_threshold',
        direction: 'tighten',
        confidence: 0.85,
        sample_size: 12,
        evidence: [],
      };
      expect(pattern.direction).toBe('tighten');
      expect(pattern.confidence).toBeGreaterThan(0);
      expect(pattern.sample_size).toBeGreaterThan(0);
    });
  });

  describe('FleetGraph', () => {
    it('captures vertices, edges, and components', () => {
      const graph: FleetGraph = { V: 9, E: 28, C: 2 };
      expect(graph.V).toBe(9);
      expect(graph.E).toBe(28);
      expect(graph.C).toBe(2);
    });
  });

  describe('ConstraintPrediction', () => {
    it('can construct a prediction with all fields', () => {
      const pred: ConstraintPrediction = {
        constraint_id: 'safety_margin',
        current_value: 0.15,
        predicted_value: 0.2,
        expected_direction: 'tighten',
        expected_override_reduction_pct: 25,
        confidence: 0.9,
        t_minus_event: 'T-1h: monitoring',
        lamport: 1,
        confirmed: false,
      };
      expect(pred.confirmed).toBe(false);
      expect(pred.actual_override_reduction_pct).toBeUndefined();
    });

    it('can be confirmed with actual data', () => {
      const pred: ConstraintPrediction = {
        constraint_id: 'trust_min',
        current_value: 0.5,
        predicted_value: 0.6,
        expected_direction: 'tighten',
        expected_override_reduction_pct: 20,
        confidence: 0.8,
        t_minus_event: 'T-0h: confirmed',
        lamport: 2,
        confirmed: true,
        actual_override_reduction_pct: 22,
      };
      expect(pred.confirmed).toBe(true);
      expect(pred.actual_override_reduction_pct).toBe(22);
    });
  });

  describe('LifecycleConstraintUpdate', () => {
    it('can represent an active update', () => {
      const update: LifecycleConstraintUpdate = {
        constraint_id: 'zhc_tolerance',
        previous_value: 0.001,
        new_value: 0.002,
        direction: 'loosen',
        confidence: 0.75,
        state: 'active',
        lamport: 3,
        timestamp: Date.now(),
      };
      expect(update.state).toBe('active');
      expect(update.superseded_by).toBeUndefined();
    });

    it('can represent a superseded update', () => {
      const update: LifecycleConstraintUpdate = {
        constraint_id: 'safety_margin',
        previous_value: 0.15,
        new_value: 0.2,
        direction: 'tighten',
        confidence: 0.8,
        state: 'superseded',
        lamport: 1,
        timestamp: Date.now() - 10000,
        superseded_by: 'safety_margin_v2',
      };
      expect(update.state).toBe('superseded');
      expect(update.superseded_by).toBe('safety_margin_v2');
    });

    it('can represent a retracted update', () => {
      const update: LifecycleConstraintUpdate = {
        constraint_id: 'trust_max',
        previous_value: 0.95,
        new_value: 0.99,
        direction: 'loosen',
        confidence: 0.3,
        state: 'retracted',
        lamport: 2,
        timestamp: Date.now() - 5000,
        retraction_reason: 'Insufficient evidence',
      };
      expect(update.state).toBe('retracted');
      expect(update.retraction_reason).toBe('Insufficient evidence');
    });
  });

  describe('CaptainDecision', () => {
    it('covers all four decision states', () => {
      const decisions: CaptainDecision[] = ['EMERGENCE', 'STABLE', 'CONSTRAINED', 'DECIDED'];
      expect(decisions).toHaveLength(4);
      for (const d of decisions) {
        expect(['EMERGENCE', 'STABLE', 'CONSTRAINED', 'DECIDED']).toContain(d);
      }
    });
  });

  describe('DecisionDelta', () => {
    it('captures captain vs user decision divergence', () => {
      const delta: DecisionDelta = { captain: 'EMERGENCE', user: 'STABLE' };
      expect(delta.captain).not.toBe(delta.user);
    });
  });

  describe('TileLifecycleState', () => {
    it('covers all three lifecycle states', () => {
      const states: TileLifecycleState[] = ['active', 'superseded', 'retracted'];
      expect(states).toHaveLength(3);
    });
  });
});
