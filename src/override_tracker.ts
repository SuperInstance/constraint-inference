/**
 * Override Tracker
 * 
 * Maintains a rolling window of override events and detects patterns.
 */

import { OverrideEvent, OverridePattern, CaptainDecision, FleetGraph } from './types';
import { inferConstraints, isSignificant } from './constraint_inferrer';

const DEFAULT_WINDOW_SIZE = 20;

interface TrackerState {
  events: OverrideEvent[];
  windowSize: number;
}

/**
 * Create a new override tracker
 */
export function createTracker(windowSize = DEFAULT_WINDOW_SIZE): TrackerState {
  return {
    events: [],
    windowSize,
  };
}

/**
 * Record a new override event
 */
export function recordOverride(
  tracker: TrackerState,
  userId: string,
  graph: FleetGraph,
  originalDecision: CaptainDecision,
  userDecision: CaptainDecision,
  reason?: string
): void {
  const event: OverrideEvent = {
    timestamp: Date.now(),
    user_id: userId,
    graph,
    original_decision: originalDecision,
    user_decision: userDecision,
    reason,
  };
  
  tracker.events.push(event);
  
  // Maintain rolling window size
  if (tracker.events.length > tracker.windowSize) {
    tracker.events = tracker.events.slice(-tracker.windowSize);
  }
  
  console.log(`[override_tracker] Recorded override: ${originalDecision} → ${userDecision} (user=${userId})`);
}

/**
 * Get all current override events
 */
export function getEvents(tracker: TrackerState): OverrideEvent[] {
  return [...tracker.events];
}

/**
 * Analyze override events and return significant patterns
 */
export function analyzeOverrides(tracker: TrackerState): OverridePattern[] {
  const patterns = inferConstraints(tracker.events);
  return patterns.filter(p => isSignificant(p));
}

/**
 * Get all patterns (not just significant ones)
 */
export function getAllPatterns(tracker: TrackerState): OverridePattern[] {
  return inferConstraints(tracker.events);
}

/**
 * Clear override history
 */
export function clearHistory(tracker: TrackerState): void {
  tracker.events = [];
  console.log('[override_tracker] History cleared');
}

/**
 * Get the number of events in the window
 */
export function getEventCount(tracker: TrackerState): number {
  return tracker.events.length;
}
