"use strict";
/**
 * Re-deliberate
 *
 * Re-runs the captain deliberation with updated constraints.
 * This is called after a significant pattern is detected and the
 * constraint model has been updated.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.reDeliberate = reDeliberate;
const plato_bridge_1 = require("./plato_bridge");
/**
 * Default delta values for each constraint direction change
 */
const DEFAULT_DELTAS = {
    emergence_beta_threshold: 0.07,
    safety_margin: 0.05,
    trust_min: 0.05,
    trust_max: 0.05,
    zhc_tolerance: 0.0001,
    action_confidence_min: 0.05,
};
/**
 * Re-run the captain with updated constraints.
 *
 * This function:
 * 1. Computes the new constraint value
 * 2. Writes to PLATO
 * 3. Triggers captain re-deliberation via PLATO signal
 * 4. Returns a result summary
 */
async function reDeliberate(pattern, model) {
    const delta = DEFAULT_DELTAS[pattern.constraint_id] || 0.05;
    const actualDelta = pattern.direction === 'tighten' ? -delta : delta;
    // Get current value
    let previousValue;
    switch (pattern.constraint_id) {
        case 'emergence_beta_threshold':
            previousValue = model.emergence_beta_threshold;
            break;
        case 'safety_margin':
            previousValue = model.safety_margin;
            break;
        case 'trust_min':
            previousValue = model.trust_min;
            break;
        case 'trust_max':
            previousValue = model.trust_max;
            break;
        case 'zhc_tolerance':
            previousValue = model.zhc_tolerance;
            break;
        case 'action_confidence_min':
            previousValue = model.action_confidence_min;
            break;
        default:
            previousValue = 0;
    }
    // Compute new value
    let newValue;
    switch (pattern.constraint_id) {
        case 'emergence_beta_threshold':
            newValue = previousValue + actualDelta;
            break;
        case 'safety_margin':
        case 'trust_min':
        case 'trust_max':
        case 'action_confidence_min':
            newValue = Math.max(0, Math.min(1, previousValue + actualDelta));
            break;
        case 'zhc_tolerance':
            newValue = Math.max(0, previousValue + actualDelta);
            break;
        default:
            newValue = previousValue + actualDelta;
    }
    // Write update to PLATO
    await (0, plato_bridge_1.writeConstraintUpdate)(pattern, previousValue, newValue, model);
    // Signal captain to re-deliberate via PLATO
    try {
        await signalCaptainReDeliberation(pattern, previousValue, newValue);
    }
    catch (err) {
        console.warn('[re_deliberate] Failed to signal captain:', err);
    }
    const message = `${pattern.constraint_id} ${pattern.direction}ed from ${previousValue.toFixed(3)} to ${newValue.toFixed(3)} based on ${pattern.sample_size} overrides (confidence: ${pattern.confidence.toFixed(2)}). Re-deliberating.`;
    console.log(`[re_deliberate] ${message}`);
    return {
        success: true,
        pattern,
        previousValue,
        newValue,
        message,
    };
}
/**
 * Signal the captain to re-deliberate with updated constraints
 */
async function signalCaptainReDeliberation(pattern, previousValue, newValue) {
    const postData = JSON.stringify({
        domain: 'captain_signals',
        question: `re_deliberate constraint:${pattern.constraint_id} old_value:${previousValue} new_value:${newValue}`,
        answer: `Captain signaled to re-deliberate with updated ${pattern.constraint_id}. User override pattern detected with ${pattern.sample_size} samples and ${pattern.confidence.toFixed(2)} confidence.`,
        confidence: pattern.confidence,
        source: 'constraint-inference',
    });
    return new Promise((resolve, reject) => {
        const req = require('http').request({
            hostname: process.env.PLATO_HOST || 'localhost',
            port: parseInt(process.env.PLATO_PORT || '8847', 10),
            path: '/room/captain_signals',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
            },
            timeout: 5000,
        }, (res) => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                console.log('[re_deliberate] Captain re-deliberation signaled');
                resolve();
            }
            else {
                reject(new Error(`HTTP ${res.statusCode}`));
            }
        });
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        req.write(postData);
        req.end();
    });
}
//# sourceMappingURL=re_deliberate.js.map