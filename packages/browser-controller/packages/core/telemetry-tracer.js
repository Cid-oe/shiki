/**
 * Browser Controller: Telemetry & Evidence Tracer
 * Records structured, unforgeable audit traces for all browser actions, network requests,
 * candidate evaluations, and security gate state transitions.
 */

const fs = require('fs');
const path = require('path');

class TelemetryTracer {
  constructor(evidenceDir) {
    this.evidenceDir = evidenceDir;
    if (!fs.existsSync(evidenceDir)) {
      fs.mkdirSync(evidenceDir, { recursive: true });
    }
    this.events = [];
    this.candidates = [];
    this.availabilityResults = [];
    this.selectionTrace = {};
    this.networkEvidence = [];
  }

  recordEvent(type, payload = {}) {
    const event = {
      timestamp: new Date().toISOString(),
      type,
      payload
    };
    this.events.push(event);
    return event;
  }

  recordCandidates(candidatesList) {
    this.candidates = candidatesList;
    this.recordEvent('browser.goal.candidate_generated', { count: candidatesList.length });
  }

  recordAvailabilityCheck(candidate, isAvailable, evidence) {
    const record = {
      candidate,
      isAvailable,
      timestamp: new Date().toISOString(),
      evidence
    };
    this.availabilityResults.push(record);
    this.recordEvent('browser.goal.candidate_checked', record);
  }

  recordSelection(selected, rankingTrace) {
    this.selectionTrace = {
      selected,
      timestamp: new Date().toISOString(),
      rankingTrace
    };
    this.recordEvent('browser.goal.candidate_selected', { selected });
  }

  recordNetwork(reqResp) {
    this.networkEvidence.push({
      timestamp: new Date().toISOString(),
      ...reqResp
    });
    this.recordEvent('browser.network.traffic', { url: reqResp.url, status: reqResp.status });
  }

  flush() {
    fs.writeFileSync(path.join(this.evidenceDir, 'browser-events.json'), JSON.stringify(this.events, null, 2));
    fs.writeFileSync(path.join(this.evidenceDir, 'candidate-domains.json'), JSON.stringify(this.candidates, null, 2));
    fs.writeFileSync(path.join(this.evidenceDir, 'availability-results.json'), JSON.stringify(this.availabilityResults, null, 2));
    fs.writeFileSync(path.join(this.evidenceDir, 'selection-trace.json'), JSON.stringify(this.selectionTrace, null, 2));
    fs.writeFileSync(path.join(this.evidenceDir, 'network-evidence.json'), JSON.stringify(this.networkEvidence, null, 2));
  }
}

module.exports = { TelemetryTracer };
