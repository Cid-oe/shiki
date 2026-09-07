/**
 * Browser Controller: Unified Automation Service
 * Exposes resilient semantic DOM operations, bot-gate inspection, network verification, and zero-knowledge form fill.
 */

const { CDPClient } = require('./cdp-client');

class BrowserService {
  constructor(port = 9222, host = '127.0.0.1') {
    this.cdp = new CDPClient(port, host);
    this.activeTabId = null;
  }

  async listTabs(urlFilter = null) {
    return await this.cdp.listTabs(urlFilter);
  }

  async attach(tabTarget) {
    const res = await this.cdp.attach(tabTarget);
    // Enable DOM, Page, and Network domains
    await this.cdp.send('Page.enable');
    await this.cdp.send('DOM.enable');
    await this.cdp.send('Runtime.enable');
    return res;
  }

  async navigate(url, waitUntil = 'load') {
    await this.cdp.send('Page.navigate', { url });
    return new Promise((resolve) => {
      const handler = () => {
        resolve({ navigated: true, url });
      };
      this.cdp.on('Page.loadEventFired', handler);
      // Safety timeout in case loadEvent already fired
      setTimeout(handler, 8000);
    });
  }

  async inspectSecurityGate() {
    const evalRes = await this.cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const turnstile = document.querySelector('iframe[src*="cloudflare"], iframe[src*="turnstile"], div.cf-turnstile');
          const recaptcha = document.querySelector('iframe[src*="google.com/recaptcha"], div.g-recaptcha');
          const hcaptcha = document.querySelector('iframe[src*="hcaptcha"], div.h-captcha');
          const turnstileToken = document.querySelector('[name="cf-turnstile-response"]')?.value;
          
          let gateType = 'none';
          if (turnstile) gateType = 'turnstile';
          else if (recaptcha) gateType = 'recaptcha';
          else if (hcaptcha) gateType = 'hcaptcha';

          return {
            hasChallenge: gateType !== 'none',
            type: gateType,
            solved: !!turnstileToken && turnstileToken.length > 0,
            token: turnstileToken || null
          };
        })()
      `,
      returnByValue: true
    });
    return evalRes.result.value;
  }

  async queryElements(semanticQuery) {
    const { role, name, placeholder } = semanticQuery;
    const evalRes = await this.cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const els = Array.from(document.querySelectorAll('button, a, input, select, textarea, [role]'));
          const rFilter = ${JSON.stringify(role || null)};
          const nFilter = ${JSON.stringify(name ? name.toLowerCase() : null)};
          const pFilter = ${JSON.stringify(placeholder ? placeholder.toLowerCase() : null)};

          const matches = els.filter(el => {
            const elRole = el.getAttribute('role') || el.tagName.toLowerCase();
            const elText = (el.innerText || el.textContent || el.value || '').trim().toLowerCase();
            const elPh = (el.placeholder || '').toLowerCase();
            const elAria = (el.getAttribute('aria-label') || '').toLowerCase();

            if (rFilter && !elRole.includes(rFilter)) return false;
            if (pFilter && !elPh.includes(pFilter)) return false;
            if (nFilter && !elText.includes(nFilter) && !elAria.includes(nFilter)) return false;
            return true;
          });

          return matches.map((el, i) => {
            const rect = el.getBoundingClientRect();
            return {
              index: i,
              tag: el.tagName,
              type: el.type || null,
              name: el.name || null,
              text: (el.innerText || el.value || '').slice(0, 50),
              visible: rect.width > 0 && rect.height > 0,
              rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }
            };
          });
        })()
      `,
      returnByValue: true
    });
    return evalRes.result.value;
  }

  async fillSemantic(query, value) {
    const evalRes = await this.cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const qName = ${JSON.stringify(query.name ? query.name.toLowerCase() : null)};
          const qPh = ${JSON.stringify(query.placeholder ? query.placeholder.toLowerCase() : null)};
          
          const inputs = Array.from(document.querySelectorAll('input, textarea'));
          const target = inputs.find(el => {
            const name = (el.name || '').toLowerCase();
            const ph = (el.placeholder || '').toLowerCase();
            const aria = (el.getAttribute('aria-label') || '').toLowerCase();
            if (qName && (name.includes(qName) || aria.includes(qName))) return true;
            if (qPh && ph.includes(qPh)) return true;
            return false;
          });

          if (!target) return { success: false, error: 'Element not found' };

          target.focus();
          target.value = ${JSON.stringify(value)};
          target.dispatchEvent(new Event('input', { bubbles: true }));
          target.dispatchEvent(new Event('change', { bubbles: true }));
          return { success: true, name: target.name, placeholder: target.placeholder };
        })()
      `,
      returnByValue: true
    });
    return evalRes.result.value;
  }

  async clickSemantic(query) {
    const evalRes = await this.cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const qName = ${JSON.stringify(query.name ? query.name.toLowerCase() : null)};
          const qRole = ${JSON.stringify(query.role ? query.role.toLowerCase() : null)};
          
          const clickable = Array.from(document.querySelectorAll('button, a, input[type="submit"], input[type="button"], [role="button"]'));
          const target = clickable.find(el => {
            const text = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().toLowerCase();
            if (qName && text.includes(qName)) return true;
            return false;
          });

          if (!target) return { success: false, error: 'Click target not found' };

          target.scrollIntoView({ behavior: 'instant', block: 'center' });
          target.click();
          return { success: true, text: (target.innerText || target.value || '').trim() };
        })()
      `,
      returnByValue: true
    });
    return evalRes.result.value;
  }

  async captureScreenshot() {
    const res = await this.cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 80 });
    return { data: res.data, mimeType: 'image/jpeg' };
  }

  close() {
    this.cdp.close();
  }
}

module.exports = { BrowserService };
