"use strict";
/**
 * Override Tracker
 *
 * Maintains a rolling window of override events and detects patterns.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTracker = createTracker;
exports.recordOverride = recordOverride;
exports.getEvents = getEvents;
exports.analyzeOverrides = analyzeOverrides;
exports.getAllPatterns = getAllPatterns;
exports.clearHistory = clearHistory;
exports.getEventCount = getEventCount;
const constraint_inferrer_1 = require("./constraint_inferrer");
const DEFAULT_WINDOW_SIZE = 20;
/**
 * Create a new override tracker
 */
function createTracker(windowSize = DEFAULT_WINDOW_SIZE) {
    return {
        events: [],
        windowSize,
    };
}
/**
 * Record a new override event
 */
function recordOverride(tracker, userId, graph, originalDecision, userDecision, reason) {
    const event = {
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
function getEvents(tracker) {
    return [...tracker.events];
}
/**
 * Analyze override events and return significant patterns
 */
function analyzeOverrides(tracker) {
    const patterns = (0, constraint_inferrer_1.inferConstraints)(tracker.events);
    return patterns.filter(p => (0, constraint_inferrer_1.isSignificant)(p));
}
/**
 * Get all patterns (not just significant ones)
 */
function getAllPatterns(tracker) {
    return (0, constraint_inferrer_1.inferConstraints)(tracker.events);
}
/**
 * Clear override history
 */
function clearHistory(tracker) {
    tracker.events = [];
    console.log('[override_tracker] History cleared');
}
/**
 * Get the number of events in the window
 */
function getEventCount(tracker) {
    return tracker.events.length;
}
//# sourceMappingURL=override_tracker.js.map