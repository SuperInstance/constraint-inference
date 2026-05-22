/**
 * Override Tracker
 *
 * Maintains a rolling window of override events and detects patterns.
 */
import { OverrideEvent, OverridePattern, CaptainDecision, FleetGraph } from './types';
interface TrackerState {
    events: OverrideEvent[];
    windowSize: number;
}
/**
 * Create a new override tracker
 */
export declare function createTracker(windowSize?: number): TrackerState;
/**
 * Record a new override event
 */
export declare function recordOverride(tracker: TrackerState, userId: string, graph: FleetGraph, originalDecision: CaptainDecision, userDecision: CaptainDecision, reason?: string): void;
/**
 * Get all current override events
 */
export declare function getEvents(tracker: TrackerState): OverrideEvent[];
/**
 * Analyze override events and return significant patterns
 */
export declare function analyzeOverrides(tracker: TrackerState): OverridePattern[];
/**
 * Get all patterns (not just significant ones)
 */
export declare function getAllPatterns(tracker: TrackerState): OverridePattern[];
/**
 * Clear override history
 */
export declare function clearHistory(tracker: TrackerState): void;
/**
 * Get the number of events in the window
 */
export declare function getEventCount(tracker: TrackerState): number;
export {};
//# sourceMappingURL=override_tracker.d.ts.map