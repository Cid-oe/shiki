/**
 * Automated Verification for:
 * 1. browser.security.handoff (Challenge detection & resumption)
 * 2. browser.goal.autonomous_completion (Candidate generation & automated option selection)
 */

const assert = require('assert');
const { GoalAutonomousCompletionEngine } = require('../packages/browser-controller/packages/core/goal-autonomous-completion');
const { SecurityHandoffEngine } = require('../packages/browser-controller/packages/core/security-handoff');

async function testGaps() {
  console.log("=========================================================");
  console.log("  Testing Newly Implemented Benchmark Gap Capabilities  ");
  console.log("=========================================================\n");

  // 1. Test browser.goal.autonomous_completion
  console.log("[1/2] Testing browser.goal.autonomous_completion...");
  const context = {
    username: "Cid-oe",
    fullName: "Siddharth U",
    projectName: "shiki"
  };

  const candidates = GoalAutonomousCompletionEngine.generateCandidateIdentifiers(context);
  assert.ok(candidates.length >= 10, "Failed to generate sufficient candidate identifiers");
  assert.ok(candidates.includes("cid-oe"), "Missing primary username candidate");
  assert.ok(candidates.includes("shiki"), "Missing project name candidate");
  console.log(` -> PASS: Generated ${candidates.length} candidate identifiers without asking the user.`);

  // Simulate availability check where 'cid-oe' is taken, but 'shiki-hub' is free
  const mockAvailability = async (name) => {
    return name === 'shiki-hub';
  };

  const selection = await GoalAutonomousCompletionEngine.selectOptimalOption(candidates, mockAvailability);
  assert.strictEqual(selection.selected, 'shiki-hub');
  assert.strictEqual(selection.exhausted, false);
  console.log(` -> PASS: Autonomously ranked & selected '${selection.selected}' with 0 user prompts.`);

  // 2. Test browser.security.handoff engine structure
  console.log("\n[2/2] Testing browser.security.handoff mock resolution...");
  let tokenFound = false;
  const mockCDP = {
    send: async (method) => {
      if (method === 'Runtime.evaluate') {
        return {
          result: {
            value: {
              hasChallenge: true,
              type: 'turnstile',
              solved: tokenFound,
              token: tokenFound ? '0.test_turnstile_token_cleared' : null
            }
          }
        };
      }
      return {};
    }
  };

  const handoff = new SecurityHandoffEngine(mockCDP);
  
  // Simulate user solving turnstile after 1.5 seconds
  setTimeout(() => {
    tokenFound = true;
  }, 1500);

  let notified = false;
  const result = await handoff.pauseAndAwaitClearance({
    timeoutMs: 5000,
    pollIntervalMs: 500,
    onDetected: (info) => {
      notified = true;
    }
  });

  assert.strictEqual(notified, true, "Failed to emit single concise user instruction");
  assert.strictEqual(result.solved, true, "Failed to resume upon token clearance");
  assert.ok(result.token.startsWith('0.test_'), "Invalid clearance token received");
  console.log(` -> PASS: Detected challenge, notified operator once, and resumed automatically (${result.durationMs}ms).`);

  console.log("\n=========================================================");
  console.log("  ALL GAP CAPABILITIES VERIFIED (2/2 PASSED)             ");
  console.log("=========================================================\n");
}

testGaps().catch(err => {
  console.error("GAP TEST FAILED:", err);
  process.exit(1);
});
