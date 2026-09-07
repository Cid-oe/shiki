/**
 * Autonomous Goal Completion & Decision Engine (browser.goal.autonomous_completion)
 * Eliminates unnecessary user interruptions by automatically generating candidates,
 * testing availability, ranking options, and selecting the optimal path autonomously.
 */

class GoalAutonomousCompletionEngine {
  /**
   * Generates candidate names from user profile, brand identity, or task context.
   */
  static generateCandidateIdentifiers(context = {}) {
    const baseNames = [];
    if (context.username) baseNames.push(context.username.toLowerCase());
    if (context.projectName) baseNames.push(context.projectName.toLowerCase());
    if (context.fullName) {
      const parts = context.fullName.toLowerCase().split(/\s+/);
      baseNames.push(parts[0]);
      if (parts.length > 1) baseNames.push(`${parts[0]}-${parts[1]}`);
    }

    const prefixes = ['', 'get-', 'the-', 'ai-'];
    const suffixes = ['', '-app', '-hub', '-lab', '-dev', '-hq'];

    const candidates = new Set();
    for (const base of baseNames) {
      const sanitized = base.replace(/[^a-z0-9-]/g, '');
      if (!sanitized) continue;
      candidates.add(sanitized);

      for (const suf of suffixes) {
        if (suf) candidates.add(`${sanitized}${suf}`);
      }
      for (const pre of prefixes) {
        if (pre) candidates.add(`${pre}${sanitized}`);
      }
    }

    return Array.from(candidates);
  }

  /**
   * Evaluates candidates against an availability checker function and picks the highest-ranked available option.
   */
  static async selectOptimalOption(candidates, checkAvailabilityFn, preferenceRanker = null) {
    const ranked = preferenceRanker 
      ? candidates.sort(preferenceRanker) 
      : candidates.sort((a, b) => a.length - b.length); // Shorter names preferred by default

    for (const candidate of ranked) {
      try {
        const isAvailable = await checkAvailabilityFn(candidate);
        if (isAvailable) {
          return {
            selected: candidate,
            evaluatedCount: ranked.indexOf(candidate) + 1,
            exhausted: false
          };
        }
      } catch (err) {
        console.warn(`Error checking availability for ${candidate}:`, err.message);
      }
    }

    return {
      selected: null,
      evaluatedCount: ranked.length,
      exhausted: true,
      error: "All generated candidate options were unavailable"
    };
  }
}

module.exports = { GoalAutonomousCompletionEngine };
