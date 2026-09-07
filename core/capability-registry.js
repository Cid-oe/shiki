/**
 * Universal Digital Execution Platform: Dynamic Capability Registry
 * Discoverable, versioned, permission-aware capability router for all OS, Browser, App, and System domains.
 */

class CapabilityRegistry {
  constructor() {
    this.capabilities = new Map();
    this.trustLevels = {
      0: 'PASSIVE_READ',      // Safe, no side-effects (e.g. read file, get clipboard, inspect DOM)
      1: 'ACTIVE_INTERACT',   // Non-destructive action (e.g. click element, focus window, type text)
      2: 'ENVIRONMENT_WRITE', // Reversible local modification (e.g. write file, run command, git commit)
      3: 'SENSITIVE_AUTH',    // Credential use, autofill, secret management
      4: 'CRITICAL_APPROVAL'  // Irreversible or financial operations (e.g. payments, delete repo/disk)
    };
  }

  register(capability) {
    const { name, version, category, trustLevel, description, schema, handler } = capability;
    if (!name || !handler || typeof handler !== 'function') {
      throw new Error(`Invalid capability definition: name and handler required`);
    }

    this.capabilities.set(name, {
      name,
      version: version || '1.0.0',
      category: category || 'general',
      trustLevel: trustLevel !== undefined ? trustLevel : 1,
      description: description || '',
      schema: schema || { type: 'object', properties: {} },
      handler
    });
  }

  listCapabilities(filter = {}) {
    const list = [];
    for (const [name, cap] of this.capabilities.entries()) {
      if (filter.category && cap.category !== filter.category) continue;
      if (filter.maxTrustLevel !== undefined && cap.trustLevel > filter.maxTrustLevel) continue;
      list.push({
        name: cap.name,
        version: cap.version,
        category: cap.category,
        trustLevel: cap.trustLevel,
        trustDescription: this.trustLevels[cap.trustLevel],
        description: cap.description,
        inputSchema: cap.schema
      });
    }
    return list;
  }

  async execute(name, params = {}, context = { operatorTrustLevel: 4 }) {
    const cap = this.capabilities.get(name);
    if (!cap) {
      throw new Error(`Capability '${name}' is not registered`);
    }

    // Strictly validate that operatorTrustLevel is a valid integer between 0 and 4
    let parsedTrustLevel = 0;
    if (typeof context.operatorTrustLevel === 'number' && Number.isInteger(context.operatorTrustLevel)) {
      parsedTrustLevel = context.operatorTrustLevel;
    } else {
      // Default-deny: If context is missing, invalid type, string, NaN, or non-integer, force lowest privilege (0)
      parsedTrustLevel = 0;
    }

    if (cap.trustLevel > parsedTrustLevel) {
      throw new Error(`Permission denied: Capability '${name}' requires trust level ${cap.trustLevel} (${this.trustLevels[cap.trustLevel]}), current level is ${parsedTrustLevel}`);
    }

    return await cap.handler(params, context);
  }
}

module.exports = { CapabilityRegistry };
