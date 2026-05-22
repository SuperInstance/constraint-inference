"use strict";
/**
 * PLATO Bridge
 *
 * Reads override events from PLATO rooms and writes constraint updates.
 * PLATO is the memory/communication layer for the fleet.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.readOverrideEvents = readOverrideEvents;
exports.writeConstraintUpdate = writeConstraintUpdate;
exports.readConstraintModel = readConstraintModel;
const http = __importStar(require("http"));
const PLATO_HOST = process.env.PLATO_HOST || 'localhost';
const PLATO_PORT = parseInt(process.env.PLATO_PORT || '8847', 10);
/**
 * Simple HTTP GET request
 */
function httpGet(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: PLATO_HOST,
            port: PLATO_PORT,
            path,
            method: 'GET',
            timeout: 5000,
        };
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                }
                else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        req.end();
    });
}
/**
 * Simple HTTP POST request
 */
function httpPost(path, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const options = {
            hostname: PLATO_HOST,
            port: PLATO_PORT,
            path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length,
            },
            timeout: 5000,
        };
        const req = http.request(options, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(responseData);
                }
                else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        req.write(data);
        req.end();
    });
}
/**
 * Parse a PLATO question string to extract override info
 * Format: user:casey original:EMERGENCE user_decision:STABLE graph:V=6,E=14,C=1 timestamp:...
 */
function parseOverrideQuestion(question) {
    try {
        const parts = question.split(' ');
        const result = {};
        for (const part of parts) {
            const [key, ...valueParts] = part.split(':');
            if (key && valueParts.length > 0) {
                result[key] = valueParts.join(':');
            }
        }
        // Parse graph string like V=6,E=14,C=1
        const graphMatch = result.graph?.match(/V=(\d+),E=(\d+),C=(\d+)/);
        const graph = graphMatch
            ? { V: parseInt(graphMatch[1]), E: parseInt(graphMatch[2]), C: parseInt(graphMatch[3]) }
            : { V: 0, E: 0, C: 0 };
        return {
            user_id: result.user || 'unknown',
            original: result.original || 'UNKNOWN',
            user_decision: result.user_decision || result.user || 'UNKNOWN',
            graph,
            timestamp: result.timestamp ? new Date(result.timestamp).getTime() : Date.now(),
        };
    }
    catch {
        return null;
    }
}
/**
 * Read recent override events from PLATO captain_overrides room
 */
async function readOverrideEvents(maxEvents = 20) {
    try {
        const response = await httpGet('/room/captain_overrides_history');
        const tiles = JSON.parse(response);
        const events = [];
        for (const tile of tiles.slice(-maxEvents)) {
            const parsed = parseOverrideQuestion(tile.question);
            if (parsed) {
                events.push({
                    timestamp: parsed.timestamp,
                    user_id: parsed.user_id,
                    graph: parsed.graph,
                    original_decision: parsed.original,
                    user_decision: parsed.user_decision,
                    reason: tile.answer,
                });
            }
        }
        console.log(`[plato_bridge] Read ${events.length} override events from PLATO`);
        return events;
    }
    catch (err) {
        console.warn('[plato_bridge] Failed to read PLATO overrides:', err);
        return [];
    }
}
/**
 * Write a constraint update to PLATO constraint_updates room
 */
async function writeConstraintUpdate(pattern, previousValue, newValue, model) {
    try {
        const tile = {
            domain: 'constraint_updates',
            question: `constraint:${pattern.constraint_id} update:${pattern.direction} delta:${newValue - previousValue} confidence:${pattern.confidence} sample_size:${pattern.sample_size}`,
            answer: `${pattern.constraint_id} ${pattern.direction}ed by ${newValue - previousValue} (from ${previousValue} to ${newValue}) based on ${pattern.sample_size} overrides. Confidence: ${pattern.confidence}. Evidence: ${pattern.evidence.length} events.`,
            confidence: pattern.confidence,
            source: 'constraint-inference',
        };
        await httpPost('/room/constraint_updates', tile);
        console.log(`[plato_bridge] Wrote constraint update to PLATO: ${pattern.constraint_id} ${pattern.direction}`);
    }
    catch (err) {
        console.warn('[plato_bridge] Failed to write to PLATO:', err);
    }
}
/**
 * Get the current constraint model from PLATO (if available)
 */
async function readConstraintModel() {
    try {
        const response = await httpGet('/room/constraint_model');
        const tiles = JSON.parse(response);
        if (tiles.length > 0) {
            const latest = tiles[tiles.length - 1];
            return JSON.parse(latest.answer);
        }
        return null;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=plato_bridge.js.map