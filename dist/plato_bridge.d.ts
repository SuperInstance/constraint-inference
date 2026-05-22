/**
 * PLATO Bridge
 *
 * Reads override events from PLATO rooms and writes constraint updates.
 * PLATO is the memory/communication layer for the fleet.
 */
import { OverridePattern, OverrideEvent, MutableConstraintModel } from './types';
/**
 * Read recent override events from PLATO captain_overrides room
 */
export declare function readOverrideEvents(maxEvents?: number): Promise<OverrideEvent[]>;
/**
 * Write a constraint update to PLATO constraint_updates room
 */
export declare function writeConstraintUpdate(pattern: OverridePattern, previousValue: number, newValue: number, model: MutableConstraintModel): Promise<void>;
/**
 * Get the current constraint model from PLATO (if available)
 */
export declare function readConstraintModel(): Promise<MutableConstraintModel | null>;
//# sourceMappingURL=plato_bridge.d.ts.map