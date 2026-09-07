/**
 * Automated Verification for Continuous Learning & Research Intelligence
 */

const assert = require('assert');
const { CapabilityRegistry } = require('../core/capability-registry');
const { registerResearchCapabilities } = require('../capabilities/research-intelligence');

async function testResearch() {
  console.log("Testing Continuous Learning & Knowledge Engine...");

  const registry = new CapabilityRegistry();
  registerResearchCapabilities(registry);

  // 1. Ingest sample financial/AI paper digest
  const sampleArticle = `
# DeepSeek-R1 and the Autonomous AI Solopreneur Revolution

Recent breakthroughs in distilled reasoning models have reduced inference costs by 90%.
Key findings for builders:
- Micro-SaaS tools can run entirely on local or low-cost reasoning APIs.
- Autonomous agent architectures reduce the need for large engineering teams.
- Solopreneurs are building $10k/month revenue streams using the tool DeepSeek-R1.
  `;

  const ingestRes = await registry.execute("research_ingest_knowledge", {
    content: sampleArticle,
    sourceUrl: "https://arxiv.org/abs/2501.12948",
    category: "ai"
  });

  assert.ok(ingestRes.insightId, "Failed to create insight record");
  assert.strictEqual(ingestRes.title, "DeepSeek-R1 and the Autonomous AI Solopreneur Revolution");
  assert.ok(ingestRes.takeawaysCount >= 3, "Failed to parse takeaways");
  console.log(` -> PASS: Ingested research article. Parsed ${ingestRes.takeawaysCount} key takeaways.`);

  // 2. Verify Deduplication
  const readCheck = await registry.execute("research_check_read_status", {
    url: "https://arxiv.org/abs/2501.12948"
  });
  assert.strictEqual(readCheck.alreadyRead, true, "Failed to remember read status");
  console.log(" -> PASS: Read deduplication memory confirmed.");

  // 3. Query Knowledge Memory
  const queryRes = await registry.execute("research_query_knowledge", {
    category: "ai",
    query: "Solopreneur"
  });
  assert.ok(queryRes.count >= 1, "Failed to retrieve stored insight");
  assert.ok(queryRes.results[0].title.includes("Autonomous AI Solopreneur"));
  console.log(` -> PASS: Retrieved stored insight from knowledge graph: '${queryRes.results[0].title}'.`);

  console.log("\n=================================================");
  console.log("  ALL RESEARCH INTELLIGENCE TESTS PASSED (3/3)   ");
  console.log("=================================================\n");
}

testResearch().catch(err => {
  console.error("RESEARCH TEST FAILED:", err);
  process.exit(1);
});
