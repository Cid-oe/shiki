/**
 * Browser Controller: Network Broker & Telemetry Engine
 * Enables request/response interception, status verification, and network idle sync.
 */

class NetworkBroker {
  constructor(cdpClient) {
    this.cdp = cdpClient;
    this.inFlightRequests = new Set();
    this.capturedTraffic = [];
    this.enabled = false;
  }

  async enable() {
    if (this.enabled) return;
    await this.cdp.send('Network.enable');

    this.cdp.on('Network.requestWillBeSent', (params) => {
      this.inFlightRequests.add(params.requestId);
      this.capturedTraffic.push({
        type: 'request',
        requestId: params.requestId,
        url: params.request.url,
        method: params.request.method,
        timestamp: params.timestamp
      });
      if (this.capturedTraffic.length > 500) this.capturedTraffic.shift();
    });

    this.cdp.on('Network.responseReceived', (params) => {
      this.inFlightRequests.delete(params.requestId);
      this.capturedTraffic.push({
        type: 'response',
        requestId: params.requestId,
        url: params.response.url,
        status: params.response.status,
        mimeType: params.response.mimeType,
        timestamp: params.timestamp
      });
      if (this.capturedTraffic.length > 500) this.capturedTraffic.shift();
    });

    this.cdp.on('Network.loadingFailed', (params) => {
      this.inFlightRequests.delete(params.requestId);
    });

    this.enabled = true;
  }

  async waitForResponse(urlPattern, expectedStatus = null, timeoutMs = 15000) {
    await this.enable();
    const regex = new RegExp(urlPattern, 'i');
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const match = this.capturedTraffic
          .filter(e => e.type === 'response' && regex.test(e.url))
          .pop();

        if (match) {
          if (expectedStatus === null || match.status === expectedStatus) {
            clearInterval(checkInterval);
            resolve(match);
            return;
          }
        }

        if (Date.now() - startTime > timeoutMs) {
          clearInterval(checkInterval);
          reject(new Error(`Timeout (${timeoutMs}ms) waiting for response matching '${urlPattern}'`));
        }
      }, 100);
    });
  }

  async waitForNetworkIdle(idleTimeMs = 500, timeoutMs = 15000) {
    await this.enable();
    const startTime = Date.now();
    let idleStart = null;

    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        if (this.inFlightRequests.size === 0) {
          if (!idleStart) idleStart = Date.now();
          else if (Date.now() - idleStart >= idleTimeMs) {
            clearInterval(interval);
            resolve({ idle: true, inFlight: 0 });
            return;
          }
        } else {
          idleStart = null;
        }

        if (Date.now() - startTime > timeoutMs) {
          clearInterval(interval);
          resolve({ idle: false, inFlight: this.inFlightRequests.size, timedOut: true });
        }
      }, 50);
    });
  }
}

module.exports = { NetworkBroker };
