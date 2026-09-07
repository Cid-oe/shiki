/**
 * Universal Knowledge Engine: Structured Long-Term Knowledge Store
 * Stores persistent concepts, research papers, financial & AI intelligence, entity graphs, and sources.
 */

const fs = require('fs');
const path = require('path');

const DB_DIR = '/home/cid/.config/agent-knowledge-engine';
const KNOWLEDGE_FILE = path.join(DB_DIR, 'knowledge-graph.json');

class KnowledgeStore {
  constructor() {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    this.data = this._load();
  }

  _load() {
    if (fs.existsSync(KNOWLEDGE_FILE)) {
      try {
        return JSON.parse(fs.readFileSync(KNOWLEDGE_FILE, 'utf8'));
      } catch (e) {
        console.error('Error parsing knowledge store, initializing new:', e);
      }
    }
    return {
      version: '1.0.0',
      entities: {},     // Companies, Tools, Authors, Influencers
      insights: [],     // Actionable findings & business opportunities
      papers: {},       // Academic/technical papers indexed by DOI/Title
      marketSignals: [],// Financial & market trend signals
      readHistory: {}   // URL -> timestamp & summary hash (avoids repeat research)
    };
  }

  _save() {
    fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(this.data, null, 2), 'utf8');
  }

  hasRead(url) {
    return !!this.data.readHistory[url];
  }

  recordRead(url, summary, metadata = {}) {
    this.data.readHistory[url] = {
      readAt: new Date().toISOString(),
      summarySnippet: summary.slice(0, 200),
      ...metadata
    };
    this._save();
  }

  addInsight(insight) {
    const record = {
      id: 'ins_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      timestamp: new Date().toISOString(),
      category: insight.category || 'general', // 'ai', 'saas', 'business_model', 'market_trend'
      title: insight.title,
      summary: insight.summary,
      actionableTakeaways: insight.actionableTakeaways || [],
      sourceUrl: insight.sourceUrl || null,
      confidenceScore: insight.confidenceScore || 0.85
    };
    this.data.insights.push(record);
    this._save();
    return record;
  }

  upsertEntity(name, type, attributes = {}) {
    const key = name.toLowerCase().trim();
    if (!this.data.entities[key]) {
      this.data.entities[key] = {
        name,
        type, // 'tool', 'company', 'creator', 'concept'
        attributes: {},
        occurrences: 0,
        firstSeen: new Date().toISOString()
      };
    }
    this.data.entities[key].occurrences += 1;
    this.data.entities[key].attributes = { ...this.data.entities[key].attributes, ...attributes };
    this.data.entities[key].lastUpdated = new Date().toISOString();
    this._save();
    return this.data.entities[key];
  }

  queryInsights(filter = {}) {
    return this.data.insights.filter(item => {
      if (filter.category && item.category !== filter.category) return false;
      if (filter.query) {
        const q = filter.query.toLowerCase();
        return item.title.toLowerCase().includes(q) || item.summary.toLowerCase().includes(q);
      }
      return true;
    });
  }

  getStats() {
    return {
      totalEntities: Object.keys(this.data.entities).length,
      totalInsights: this.data.insights.length,
      totalReadUrls: Object.keys(this.data.readHistory).length,
      categories: [...new Set(this.data.insights.map(i => i.category))]
    };
  }
}

module.exports = { KnowledgeStore };
