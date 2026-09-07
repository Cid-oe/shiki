/**
 * Structured Knowledge Extractor
 * Extracts actionable business opportunities, AI tools, companies, and key concepts
 * from raw markdown, text, or research paper digests.
 */

class KnowledgeExtractor {
  static extractEntities(text) {
    const tools = [];
    const concepts = [];

    // Simple heuristic regex patterns for tools and capitalized concepts
    const toolMatches = text.match(/(?:tool|framework|library|model|platform|API|software)\s+(?:called|named|is|like)?\s*([A-Z][a-zA-Z0-9\-_]+)/gi) || [];
    for (const m of toolMatches) {
      const parts = m.split(/\s+/);
      const name = parts[parts.length - 1].replace(/[.,]/g, '');
      if (name.length > 2 && !tools.includes(name)) tools.push(name);
    }

    return {
      tools,
      concepts
    };
  }

  static parseResearchDigest(sourceUrl, rawContent) {
    const lines = rawContent.split('\n').map(l => l.trim()).filter(Boolean);
    const title = lines[0]?.replace(/^#+\s*/, '') || 'Untitled Source';
    
    // Extract key takeaways (lines starting with bullet points or numbers)
    const takeaways = lines
      .filter(l => /^[-*•\d.]\s+/.test(l))
      .map(l => l.replace(/^[-*•\d.]\s+/, ''))
      .slice(0, 10);

    const entities = this.extractEntities(rawContent);

    return {
      title,
      summary: lines.slice(0, 5).join(' ').slice(0, 500),
      takeaways,
      entities,
      sourceUrl
    };
  }
}

module.exports = { KnowledgeExtractor };
