/**
 * Mutable Constraint Model
 *
 * Handles loading, saving, and updating the constraint model that
 * gets modified based on user override patterns.
 */
import { MutableConstraintModel } from './types';
/**
 * Load constraint model from disk, or return defaults if none exists
 */
export declare function loadModel(): MutableConstraintModel;
/**
 * Persist constraint model to disk
 */
export declare function saveModel(model: MutableConstraintModel): void;
/**
 * Update a specific constraint value
 */
export declare function updateConstraint(model: MutableConstraintModel, constraintId: string, delta: number): MutableConstraintModel;
//# sourceMappingURL=constraint_model.d.ts.map