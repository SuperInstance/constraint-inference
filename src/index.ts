/**
 * Constraint Inference Engine
 * 
 * Watches user override patterns and reverse-engineers what constraint
 * parameters need updating. The core insight: behavior reveals constraints.
 * 
 * Run: npx ts-node src/index.ts
 */

import * as http from 'http';
import { CaptainDecision, FleetGraph, MutableConstraintModel, OverridePattern } from './types';
import { loadModel, saveModel, updateConstraint } from './constraint_model';
import { createTracker, recordOverride, analyzeOverrides, getAllPatterns, getEventCount } from './override_tracker';
import { readOverrideEvents, writeConstraintUpdate } from './plato_bridge';
import { reDeliberate } from './re_deliberate';

// Configuration
const POLL_INTERVAL_MS = 10000;  // 10 seconds
const CONFIDENCE_THRESHOLD = 0.75;
const MIN_SAMPLES = 3;

// State
let constraintModel: MutableConstraintModel;
let tracker = createTracker(20);
let running = true;

/**
 * Main initialization
 */
function init(): void {
  console.log('[constraint-inference] Starting...');
  
  // Load constraint model from disk
  constraintModel = loadModel();
  console.log('[constraint-inference] Model loaded:', JSON.stringify(constraintModel));
  
  // Try to load existing override events from PLATO
  loadHistoricalEvents();
}

/**
 * Load historical override events from PLATO to bootstrap the tracker
 */
async function loadHistoricalEvents(): Promise<void> {
  try {
    const events = await readOverrideEvents(20);
    if (events.length > 0) {
      console.log(`[constraint-inference] Loaded ${events.length} historical events from PLATO`);
      // Note: events are already recorded in PLATO, so we've bootstrapped
    }
  } catch (err) {
    console.warn('[constraint-inference] Could not load historical events:', err);
  }
}

/**
 * Main polling loop
 */
async function poll(): Promise<void> {
  if (!running) return;
  
  try {
    // Check for new PLATO events
    const events = await readOverrideEvents(5);
    
    // Analyze patterns
    const significantPatterns = analyzeOverrides(tracker);
    
    // Process any significant patterns
    for (const pattern of significantPatterns) {
      await processPattern(pattern);
    }
    
    // Log current status
    const allPatterns = getAllPatterns(tracker);
    if (allPatterns.length > 0) {
      console.log(`[constraint-inference] ${getEventCount(tracker)} events, ${allPatterns.length} patterns detected`);
    }
  } catch (err) {
    console.error('[constraint-inference] Poll error:', err);
  }
}

/**
 * Process a significant override pattern
 */
async function processPattern(pattern: OverridePattern): Promise<void> {
  console.log(`[constraint-inference] Pattern detected: ${pattern.constraint_id} ${pattern.direction} (confidence: ${pattern.confidence.toFixed(2)}, samples: ${pattern.sample_size})`);
  
  // Compute delta based on direction
  const deltaMap: Record<string, number> = {
    emergence_beta_threshold: 0.07,
    safety_margin: 0.05,
    trust_min: 0.05,
    trust_max: 0.05,
    zhc_tolerance: 0.0001,
    action_confidence_min: 0.05,
  };
  
  const delta = deltaMap[pattern.constraint_id] || 0.05;
  const actualDelta = pattern.direction === 'tighten' ? -delta : delta;
  
  // Get current value
  let previousValue = 0;
  switch (pattern.constraint_id) {
    case 'emergence_beta_threshold': previousValue = constraintModel.emergence_beta_threshold; break;
    case 'safety_margin': previousValue = constraintModel.safety_margin; break;
    case 'trust_min': previousValue = constraintModel.trust_min; break;
    case 'trust_max': previousValue = constraintModel.trust_max; break;
    case 'zhc_tolerance': previousValue = constraintModel.zhc_tolerance; break;
    case 'action_confidence_min': previousValue = constraintModel.action_confidence_min; break;
  }
  
  // Update the model
  const updatedModel = updateConstraint(constraintModel, pattern.constraint_id, actualDelta);
  constraintModel = updatedModel;
  saveModel(updatedModel);
  
  // Log to PLATO
  await writeConstraintUpdate(pattern, previousValue, actualDelta, updatedModel);
  
  // Re-deliberate
  await reDeliberate(pattern, updatedModel);
  
  // Alert message for Casey
  const alertMessage = formatAlert(pattern, previousValue, actualDelta, updatedModel);
  console.log(`[constraint-inference] ALERT: ${alertMessage}`);
}

/**
 * Format alert message for Casey
 */
function formatAlert(
  pattern: OverridePattern,
  previousValue: number,
  delta: number,
  model: MutableConstraintModel
): string {
  const newValue = previousValue + delta;
  return `${pattern.constraint_id} ${pattern.direction}ed ${previousValue.toFixed(2)} → ${newValue.toFixed(2)} based on your last ${pattern.sample_size} overrides (confidence: ${pattern.confidence.toFixed(2)}). Re-deliberating.`;
}

/**
 * HTTP API for external override injection
 * 
 * POST /override with JSON body:
 * {
 *   "user_id": "casey",
 *   "graph": { "V": 6, "E": 14, "C": 1 },
 *   "original_decision": "EMERGENCE",
 *   "user_decision": "STABLE",
 *   "reason": "this looks stable to me"
 * }
 */
function createApiServer(): http.Server {
  return http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    
    // Health check
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', events: getEventCount(tracker) }));
      return;
    }
    
    // Get current model
    if (req.method === 'GET' && req.url === '/model') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(constraintModel));
      return;
    }
    
    // Get current patterns
    if (req.method === 'GET' && req.url === '/patterns') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(getAllPatterns(tracker)));
      return;
    }
    
    // Handle override POST
    if (req.method === 'POST' && req.url === '/override') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const { user_id, graph, original_decision, user_decision, reason } = data;
          
          if (!user_id || !original_decision || !user_decision) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing required fields' }));
            return;
          }
          
          const fleetGraph: FleetGraph = graph || { V: 0, E: 0, C: 0 };
          
          // Record the override
          recordOverride(
            tracker,
            user_id,
            fleetGraph,
            original_decision as CaptainDecision,
            user_decision as CaptainDecision,
            reason
          );
          
          // Check for significant patterns
          const patterns = analyzeOverrides(tracker);
          if (patterns.length > 0) {
            processPattern(patterns[0]).catch(console.error);
          }
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            status: 'recorded',
            patterns_found: patterns.length,
            significant: patterns.length > 0
          }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }
    
    // Stop endpoint
    if (req.method === 'POST' && req.url === '/stop') {
      running = false;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'stopping' }));
      return;
    }
    
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  init();
  
  // Start HTTP API on port 9439
  const server = createApiServer();
  server.listen(9439, () => {
    console.log('[constraint-inference] API server listening on :9439');
  });
  
  // Main loop
  console.log('[constraint-inference] Entering main loop...');
  while (running) {
    await poll();
    await sleep(POLL_INTERVAL_MS);
  }
  
  console.log('[constraint-inference] Shutdown complete');
  process.exit(0);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('[constraint-inference] Received SIGINT, shutting down...');
  running = false;
});

process.on('SIGTERM', () => {
  console.log('[constraint-inference] Received SIGTERM, shutting down...');
  running = false;
});

// Run
main().catch(err => {
  console.error('[constraint-inference] Fatal error:', err);
  process.exit(1);
});
