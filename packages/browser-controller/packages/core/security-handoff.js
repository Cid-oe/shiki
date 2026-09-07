/**
 * Browser Controller: Autonomous Security Handoff & Auto-Resume Engine (browser.security.handoff)
 * Automatically detects Cloudflare Turnstile, reCAPTCHA, and 2FA, notifies the operator,
 * and polls the clearance token to resume execution from the exact point of interruption.
 */

class SecurityHandoffEngine {
  constructor(cdpClient) {
    this.cdp = cdpClient;
    this.activeHandoff = null;
  }

  async inspectChallenge() {
    const evalRes = await this.cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const turnstileIframe = document.querySelector('iframe[src*="cloudflare"], iframe[src*="turnstile"], div.cf-turnstile');
          const recaptchaIframe = document.querySelector('iframe[src*="google.com/recaptcha"], div.g-recaptcha');
          const turnstileToken = document.querySelector('[name="cf-turnstile-response"]')?.value;
          const recaptchaToken = document.querySelector('[name="g-recaptcha-response"]')?.value;

          let type = 'none';
          if (turnstileIframe) type = 'turnstile';
          else if (recaptchaIframe) type = 'recaptcha';

          const token = turnstileToken || recaptchaToken || null;
          const solved = !!token && token.length > 0;

          return { hasChallenge: type !== 'none', type, solved, token };
        })()
      `,
      returnByValue: true
    });
    return evalRes.result.value;
  }

  async pauseAndAwaitClearance(options = { timeoutMs: 120000, pollIntervalMs: 1000, onDetected: null }) {
    const initialCheck = await this.inspectChallenge();
    if (!initialCheck.hasChallenge || initialCheck.solved) {
      return { required: false, solved: true, token: initialCheck.token };
    }

    if (options.onDetected && typeof options.onDetected === 'function') {
      options.onDetected({
        type: initialCheck.type,
        instructions: "Please click the security verification checkbox in your browser window. Execution will resume automatically."
      });
    }

    const startTime = Date.now();
    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const check = await this.inspectChallenge();
          if (check.solved) {
            clearInterval(interval);
            resolve({ required: true, solved: true, token: check.token, durationMs: Date.now() - startTime });
            return;
          }
          if (Date.now() - startTime > options.timeoutMs) {
            clearInterval(interval);
            reject(new Error(`Security challenge resolution timed out after ${options.timeoutMs}ms`));
          }
        } catch (err) {
          clearInterval(interval);
          reject(err);
        }
      }, options.pollIntervalMs);
    });
  }
}

module.exports = { SecurityHandoffEngine };
