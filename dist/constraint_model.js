"use strict";
/**
 * Mutable Constraint Model
 *
 * Handles loading, saving, and updating the constraint model that
 * gets modified based on user override patterns.
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
exports.loadModel = loadModel;
exports.saveModel = saveModel;
exports.updateConstraint = updateConstraint;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const types_1 = require("./types");
const CONFIG_DIR = path.join(process.env.HOME || '/root', '.config', 'constraint-inference');
const MODEL_FILE = path.join(CONFIG_DIR, 'model.json');
/**
 * Load constraint model from disk, or return defaults if none exists
 */
function loadModel() {
    try {
        if (fs.existsSync(MODEL_FILE)) {
            const raw = fs.readFileSync(MODEL_FILE, 'utf-8');
            const parsed = JSON.parse(raw);
            // Merge with defaults to ensure all fields exist
            return { ...types_1.DEFAULT_MODEL, ...parsed };
        }
    }
    catch (err) {
        console.error('[constraint_model] Failed to load model:', err);
    }
    return { ...types_1.DEFAULT_MODEL };
}
/**
 * Persist constraint model to disk
 */
function saveModel(model) {
    try {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
        fs.writeFileSync(MODEL_FILE, JSON.stringify(model, null, 2), 'utf-8');
        console.log(`[constraint_model] Model saved to ${MODEL_FILE}`);
    }
    catch (err) {
        console.error('[constraint_model] Failed to save model:', err);
    }
}
/**
 * Update a specific constraint value
 */
function updateConstraint(model, constraintId, delta) {
    const updated = { ...model };
    switch (constraintId) {
        case 'emergence_beta_threshold':
            updated.emergence_beta_threshold += delta;
            break;
        case 'safety_margin':
            updated.safety_margin = Math.max(0, Math.min(1, updated.safety_margin + delta));
            break;
        case 'trust_min':
            updated.trust_min = Math.max(0, Math.min(1, updated.trust_min + delta));
            break;
        case 'trust_max':
            updated.trust_max = Math.max(0, Math.min(1, updated.trust_max + delta));
            break;
        case 'zhc_tolerance':
            updated.zhc_tolerance = Math.max(0, updated.zhc_tolerance + delta);
            break;
        case 'action_confidence_min':
            updated.action_confidence_min = Math.max(0, Math.min(1, updated.action_confidence_min + delta));
            break;
        default:
            console.warn(`[constraint_model] Unknown constraint: ${constraintId}`);
            return model;
    }
    return updated;
}
//# sourceMappingURL=constraint_model.js.map