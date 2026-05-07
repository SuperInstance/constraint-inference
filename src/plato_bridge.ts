/**
 * PLATO Bridge
 * 
 * Reads override events from PLATO rooms and writes constraint updates.
 * PLATO is the memory/communication layer for the fleet.
 */

import * as http from 'http';
import * as https from 'https';
import { OverridePattern, OverrideEvent, MutableConstraintModel, FleetGraph } from './types';

const PLATO_HOST = process.env.PLATO_HOST || 'localhost';
const PLATO_PORT = parseInt(process.env.PLATO_PORT || '8847', 10);

interface PlatoTile {
  id: string;
  domain: string;
  question: string;
  answer: string;
  confidence: number;
  source: string;
  timestamp?: number;
}

/**
 * Simple HTTP GET request
 */
function httpGet(path: string): Promise<string> {
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
        } else {
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
function httpPost(path: string, body: object): Promise<string> {
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
        } else {
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
function parseOverrideQuestion(question: string): {
  user_id: string;
  original: string;
  user_decision: string;
  graph: FleetGraph;
  timestamp: number;
} | null {
  try {
    const parts = question.split(' ');
    const result: Record<string, string> = {};
    
    for (const part of parts) {
      const [key, ...valueParts] = part.split(':');
      if (key && valueParts.length > 0) {
        result[key] = valueParts.join(':');
      }
    }
    
    // Parse graph string like V=6,E=14,C=1
    const graphMatch = result.graph?.match(/V=(\d+),E=(\d+),C=(\d+)/);
    const graph: FleetGraph = graphMatch
      ? { V: parseInt(graphMatch[1]), E: parseInt(graphMatch[2]), C: parseInt(graphMatch[3]) }
      : { V: 0, E: 0, C: 0 };
    
    return {
      user_id: result.user || 'unknown',
      original: result.original || 'UNKNOWN',
      user_decision: result.user_decision || result.user || 'UNKNOWN',
      graph,
      timestamp: result.timestamp ? new Date(result.timestamp).getTime() : Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * Read recent override events from PLATO captain_overrides room
 */
export async function readOverrideEvents(maxEvents = 20): Promise<OverrideEvent[]> {
  try {
    const response = await httpGet('/room/captain_overrides_history');
    const tiles: PlatoTile[] = JSON.parse(response);
    
    const events: OverrideEvent[] = [];
    for (const tile of tiles.slice(-maxEvents)) {
      const parsed = parseOverrideQuestion(tile.question);
      if (parsed) {
        events.push({
          timestamp: parsed.timestamp,
          user_id: parsed.user_id,
          graph: parsed.graph,
          original_decision: parsed.original as any,
          user_decision: parsed.user_decision as any,
          reason: tile.answer,
        });
      }
    }
    
    console.log(`[plato_bridge] Read ${events.length} override events from PLATO`);
    return events;
  } catch (err) {
    console.warn('[plato_bridge] Failed to read PLATO overrides:', err);
    return [];
  }
}

/**
 * Write a constraint update to PLATO constraint_updates room
 */
export async function writeConstraintUpdate(
  pattern: OverridePattern,
  previousValue: number,
  newValue: number,
  model: MutableConstraintModel
): Promise<void> {
  try {
    const tile: Omit<PlatoTile, 'id'> = {
      domain: 'constraint_updates',
      question: `constraint:${pattern.constraint_id} update:${pattern.direction} delta:${newValue - previousValue} confidence:${pattern.confidence} sample_size:${pattern.sample_size}`,
      answer: `${pattern.constraint_id} ${pattern.direction}ed by ${newValue - previousValue} (from ${previousValue} to ${newValue}) based on ${pattern.sample_size} overrides. Confidence: ${pattern.confidence}. Evidence: ${pattern.evidence.length} events.`,
      confidence: pattern.confidence,
      source: 'constraint-inference',
    };
    
    await httpPost('/room/constraint_updates', tile);
    console.log(`[plato_bridge] Wrote constraint update to PLATO: ${pattern.constraint_id} ${pattern.direction}`);
  } catch (err) {
    console.warn('[plato_bridge] Failed to write to PLATO:', err);
  }
}

/**
 * Get the current constraint model from PLATO (if available)
 */
export async function readConstraintModel(): Promise<MutableConstraintModel | null> {
  try {
    const response = await httpGet('/room/constraint_model');
    const tiles: PlatoTile[] = JSON.parse(response);
    
    if (tiles.length > 0) {
      const latest = tiles[tiles.length - 1];
      return JSON.parse(latest.answer);
    }
    return null;
  } catch {
    return null;
  }
}
