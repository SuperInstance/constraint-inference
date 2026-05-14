import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// Shared mock state
const mockState = {
  responses: new Map<string, { status: number; body: string }>(),
  requestLog: [] as { method: string; path: string; body?: string }[],
};

// Mock http module with proper named exports
vi.mock('http', () => ({
  request: (options: any, callback: any) => {
    const path = options.path || '/';
    const method = options.method || 'GET';
    let pendingBody: string | undefined;

    const mockRes = mockState.responses.get(path);

    const req = {
      on: (event: string, handler: any) => {
        // no-op for error/timeout unless we want to simulate
      },
      write: (data: string) => {
        pendingBody = data;
      },
      end: () => {
        // Simulate async response
        setTimeout(() => {
          mockState.requestLog.push({ method, path, body: pendingBody });

          const statusCode = mockRes?.status || 404;
          const responseBody = mockRes?.body || 'Not found';

          const res = {
            statusCode,
            on: (event: string, handler: any) => {
              if (event === 'data') handler(responseBody);
              if (event === 'end') handler();
            },
          };

          callback(res);
        }, 0);
      },
      destroy: () => {},
    };

    return req;
  },
}));

// Set env before import
process.env.PLATO_HOST = 'localhost';
process.env.PLATO_PORT = '8847';

import * as bridge from '../src/plato_bridge';

describe('plato_bridge', () => {
  beforeEach(() => {
    mockState.requestLog = [];
    mockState.responses.clear();
  });

  it('readOverrideEvents returns parsed events from PLATO', async () => {
    mockState.responses.set('/room/captain_overrides_history', {
      status: 200,
      body: JSON.stringify([
        {
          id: '1',
          domain: 'captain_overrides',
          question: 'user:casey original:EMERGENCE user_decision:STABLE graph:V=6,E=14,C=1 timestamp:2024-01-01T00:00:00Z',
          answer: 'User preferred stable',
          confidence: 0.9,
          source: 'captain',
        },
        {
          id: '2',
          domain: 'captain_overrides',
          question: 'user:casey original:STABLE user_decision:CONSTRAINED graph:V=3,E=5,C=1 timestamp:2024-01-02T00:00:00Z',
          answer: 'User tightened',
          confidence: 0.85,
          source: 'captain',
        },
      ]),
    });

    const events = await bridge.readOverrideEvents(20);

    expect(events).toHaveLength(2);
    expect(events[0].user_id).toBe('casey');
    expect(events[0].original_decision).toBe('EMERGENCE');
    expect(events[0].user_decision).toBe('STABLE');
    expect(events[0].graph).toEqual({ V: 6, E: 14, C: 1 });
    expect(events[1].user_decision).toBe('CONSTRAINED');
    expect(events[0].reason).toBe('User preferred stable');
  });

  it('readOverrideEvents handles empty response', async () => {
    mockState.responses.set('/room/captain_overrides_history', {
      status: 200,
      body: JSON.stringify([]),
    });

    const events = await bridge.readOverrideEvents();
    expect(events).toEqual([]);
  });

  it('readOverrideEvents handles malformed question gracefully', async () => {
    mockState.responses.set('/room/captain_overrides_history', {
      status: 200,
      body: JSON.stringify([
        {
          id: 'bad',
          domain: 'captain_overrides',
          question: 'not_a_valid_question_format',
          answer: 'broken',
          confidence: 0.5,
          source: 'test',
        },
      ]),
    });

    const events = await bridge.readOverrideEvents();
    expect(events).toHaveLength(1);
    expect(events[0].graph).toEqual({ V: 0, E: 0, C: 0 });
  });

  it('readOverrideEvents returns empty on HTTP error', async () => {
    // No mock response set → 404 → throws → caught → returns []
    const events = await bridge.readOverrideEvents();
    expect(events).toEqual([]);
  });

  it('writeConstraintUpdate sends POST to PLATO', async () => {
    mockState.responses.set('/room/constraint_updates', {
      status: 200,
      body: '{"ok":true}',
    });

    await bridge.writeConstraintUpdate(
      {
        constraint_id: 'safety_margin',
        direction: 'tighten',
        confidence: 0.9,
        sample_size: 10,
        evidence: [],
      },
      0.15,
      0.2,
      { emergence_beta_threshold: -2, safety_margin: 0.15, trust_min: 0.5, trust_max: 0.95, zhc_tolerance: 0.001, action_confidence_min: 0.7 }
    );

    // Wait for async request to complete
    await new Promise(r => setTimeout(r, 50));

    expect(mockState.requestLog.length).toBeGreaterThanOrEqual(1);
    const postReq = mockState.requestLog.find(r => r.method === 'POST' && r.path === '/room/constraint_updates');
    expect(postReq).toBeDefined();
    const body = JSON.parse(postReq!.body!);
    expect(body.domain).toBe('constraint_updates');
    expect(body.source).toBe('constraint-inference');
    expect(body.confidence).toBe(0.9);
  });

  it('writePredictionTile sends prediction to /submit', async () => {
    mockState.responses.set('/submit', {
      status: 200,
      body: '{"ok":true}',
    });

    await bridge.writePredictionTile({
      constraint_id: 'trust_min',
      current_value: 0.5,
      predicted_value: 0.6,
      expected_direction: 'tighten',
      expected_override_reduction_pct: 25,
      confidence: 0.85,
      t_minus_event: 'T-1h: monitoring',
      lamport: 5,
      confirmed: false,
    });

    await new Promise(r => setTimeout(r, 50));

    const postReq = mockState.requestLog.find(r => r.method === 'POST' && r.path === '/submit');
    expect(postReq).toBeDefined();
    const body = JSON.parse(postReq!.body!);
    expect(body.room).toBe('constraint_predictions');
    expect(body.lamport_clock).toBe(5);
  });

  it('supersedePrediction sends supersede request', async () => {
    mockState.responses.set('/supersede', {
      status: 200,
      body: '{"ok":true}',
    });

    await bridge.supersedePrediction(3, {
      constraint_id: 'safety_margin',
      current_value: 0.15,
      predicted_value: 0.2,
      expected_direction: 'tighten',
      expected_override_reduction_pct: 25,
      confidence: 0.9,
      t_minus_event: 'T-0: confirmed',
      lamport: 4,
      confirmed: true,
      actual_override_reduction_pct: 28,
    });

    await new Promise(r => setTimeout(r, 50));

    const postReq = mockState.requestLog.find(r => r.method === 'POST' && r.path === '/supersede');
    expect(postReq).toBeDefined();
    const body = JSON.parse(postReq!.body!);
    expect(body.old_lamport).toBe(3);
    expect(body.room).toBe('constraint_predictions');
  });

  it('getStats returns stats from PLATO', async () => {
    mockState.responses.set('/stats', {
      status: 200,
      body: JSON.stringify({ rooms: 5, tiles: 120, uptime: 3600 }),
    });

    const stats = await bridge.getStats();
    expect(stats).toEqual({ rooms: 5, tiles: 120, uptime: 3600 });
  });

  it('getStats returns null on HTTP error', async () => {
    const stats = await bridge.getStats();
    expect(stats).toBeNull();
  });

  it('readConstraintModel returns model from PLATO', async () => {
    mockState.responses.set('/room/constraint_model', {
      status: 200,
      body: JSON.stringify([
        {
          id: '1',
          domain: 'constraint_model',
          question: 'current model',
          answer: JSON.stringify({
            emergence_beta_threshold: -3,
            safety_margin: 0.2,
            trust_min: 0.6,
            trust_max: 0.97,
            zhc_tolerance: 0.002,
            action_confidence_min: 0.75,
          }),
          confidence: 0.95,
          source: 'constraint-inference',
        },
      ]),
    });

    const model = await bridge.readConstraintModel();
    expect(model).not.toBeNull();
    expect(model!.safety_margin).toBe(0.2);
    expect(model!.emergence_beta_threshold).toBe(-3);
  });

  it('readConstraintModel returns null when no tiles', async () => {
    mockState.responses.set('/room/constraint_model', {
      status: 200,
      body: JSON.stringify([]),
    });

    const model = await bridge.readConstraintModel();
    expect(model).toBeNull();
  });

  it('readConstraintModel returns null on HTTP error', async () => {
    const model = await bridge.readConstraintModel();
    expect(model).toBeNull();
  });
});
