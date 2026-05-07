/**
 * Mutable Constraint Model
 * 
 * Handles loading, saving, and updating the constraint model that
 * gets modified based on user override patterns.
 */

import * as fs from 'fs';
import * as path from 'path';
import { MutableConstraintModel, DEFAULT_MODEL } from './types';

const CONFIG_DIR = path.join(process.env.HOME || '/root', '.config', 'constraint-inference');
const MODEL_FILE = path.join(CONFIG_DIR, 'model.json');

/**
 * Load constraint model from disk, or return defaults if none exists
 */
export function loadModel(): MutableConstraintModel {
  try {
    if (fs.existsSync(MODEL_FILE)) {
      const raw = fs.readFileSync(MODEL_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      // Merge with defaults to ensure all fields exist
      return { ...DEFAULT_MODEL, ...parsed };
    }
  } catch (err) {
    console.error('[constraint_model] Failed to load model:', err);
  }
  return { ...DEFAULT_MODEL };
}

/**
 * Persist constraint model to disk
 */
export function saveModel(model: MutableConstraintModel): void {
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(MODEL_FILE, JSON.stringify(model, null, 2), 'utf-8');
    console.log(`[constraint_model] Model saved to ${MODEL_FILE}`);
  } catch (err) {
    console.error('[constraint_model] Failed to save model:', err);
  }
}

/**
 * Update a specific constraint value
 */
export function updateConstraint(
  model: MutableConstraintModel,
  constraintId: string,
  delta: number
): MutableConstraintModel {
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
