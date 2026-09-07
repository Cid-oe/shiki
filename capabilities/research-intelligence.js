/**
 * Research & Financial Intelligence Capability
 * Ingests academic papers, technical documentation, social media feeds, and financial articles,
 * extracts actionable business insights, and saves them into the persistent Knowledge Store.
 */

const { KnowledgeStore } = require('../knowledge-engine/db/knowledge-store');
const { KnowledgeExtractor } = require('../knowledge-engine/extractors/knowledge-extractor');

function registerResearchCapabilities(registry) {
  const store = new KnowledgeStore();

  // 1. Ingest & extract structured knowledge from text / paper
  registry.register({
    name: "research_ingest_knowledge",
    version: "1.0.0",
    category: "research",
    trustLevel: 1,
    description: "Ingests raw research, article text, or social threads, extracts key insights/tools, and persists into durable memory.",
    schema: {
      type: "object",
      required: ["content"],
      properties: {
        content: { type: "string", description: "Article or paper text" },
        sourceUrl: { type: "string", description: "URL or DOI source" },
        category: { type: "string", enum: ["ai", "saas", "solopreneurship", "market_trend", "finance"], default: "ai" }
      }
    },
    handler: async ({ content, sourceUrl, category = "ai" }) => {
      const digest = KnowledgeExtractor.parseResearchDigest(sourceUrl || 'direct_input', content);
      
      // Save insight
      const insight = store.addInsight({
        category,
        title: digest.title,
        summary: digest.summary,
        actionableTakeaways: digest.takeaways,
        sourceUrl: sourceUrl || null
      });

      // Upsert identified entities
      for (const tool of digest.entities.tools) {
        store.upsertEntity(tool, 'tool', { category, mentionedIn: digest.title });
      }

      if (sourceUrl) {
        store.recordRead(sourceUrl, digest.summary);
      }

      return {
        insightId: insight.id,
        title: digest.title,
        takeawaysCount: digest.takeaways.length,
        entitiesDiscovered: digest.entities.tools
      };
    }
  });

  // 2. Query stored knowledge memory
  registry.register({
    name: "research_query_knowledge",
    version: "1.0.0",
    category: "research",
    trustLevel: 0,
    description: "Queries persistent knowledge memory for previously extracted business opportunities, concepts, and papers.",
    schema: {
      type: "object",
      properties: {
        category: { type: "string" },
        query: { type: "string", description: "Search term" }
      }
    },
    handler: async ({ category, query }) => {
      const insights = store.queryInsights({ category, query });
      return {
        count: insights.length,
        results: insights.slice(0, 10)
      };
    }
  });

  // 3. Check if source already read (deduplication)
  registry.register({
    name: "research_check_read_status",
    version: "1.0.0",
    category: "research",
    trustLevel: 0,
    description: "Checks if an article, paper, or social profile has already been ingested into knowledge memory.",
    schema: {
      type: "object",
      required: ["url"],
      properties: {
        url: { type: "string" }
      }
    },
    handler: async ({ url }) => {
      return { alreadyRead: store.hasRead(url) };
    }
  });

  // 4. Social Media Goal-Driven Content Harvester
  registry.register({
    name: "research_harvest_social_feed",
    version: "1.0.0",
    category: "research",
    trustLevel: 1,
    description: "Goal-driven reader for social media feeds (X, Reddit, LinkedIn). Stops when target quota of insights is collected.",
    schema: {
      type: "object",
      required: ["platform", "topic"],
      properties: {
        platform: { type: "string", enum: ["x", "reddit", "linkedin", "hackernews"] },
        topic: { type: "string" },
        maxItems: { type: "integer", default: 10 }
      }
    },
    handler: async ({ platform, topic, maxItems = 10 }) => {
      // Returns structured extraction template ready for browser ambient feed reader
      return {
        platform,
        topic,
        maxItems,
        extractionProtocol: "Goal-driven bounded scroll: extract text, author, metrics, and filter for novelty against knowledge-store."
      };
    }
  });
}

module.exports = { registerResearchCapabilities };
