/**
 * Re-deliberate
 *
 * Re-runs the captain deliberation with updated constraints.
 * This is called after a significant pattern is detected and the
 * constraint model has been updated.
 */
import { MutableConstraintModel, OverridePattern } from './types';
interface ReDeliberateResult {
    success: boolean;
    pattern: OverridePattern;
    previousValue: number;
    newValue: number;
    message: string;
}
/**
 * Re-run the captain with updated constraints.
 *
 * This function:
 * 1. Computes the new constraint value
 * 2. Writes to PLATO
 * 3. Triggers captain re-deliberation via PLATO signal
 * 4. Returns a result summary
 */
export declare function reDeliberate(pattern: OverridePattern, model: MutableConstraintModel): Promise<ReDeliberateResult>;
export {};
//# sourceMappingURL=re_deliberate.d.ts.map