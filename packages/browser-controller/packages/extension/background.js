// Browser Controller: Manifest V3 Service Worker
const NATIVE_HOST = "com.agent.browser_controller";
let port = null;

function connectNative() {
  try {
    port = chrome.runtime.connectNative(NATIVE_HOST);
    port.onMessage.addListener(handleHostMessage);
    port.onDisconnect.addListener(() => {
      console.warn("Native host disconnected. Reconnecting in 3s...");
      port = null;
      setTimeout(connectNative, 3000);
    });
  } catch (err) {
    console.error("Failed to connect to native host:", err);
  }
}

async function handleHostMessage(msg) {
  const { id, method, params } = msg;
  try {
    let result;
    switch (method) {
      case "listTabs":
        result = await chrome.tabs.query({});
        break;
      case "navigate":
        result = await chrome.tabs.update(params.tabId, { url: params.url });
        break;
      case "inspectGate":
        result = await inspectSecurityGate(params.tabId);
        break;
      default:
        throw new Error(`Unknown method: ${method}`);
    }
    port.postMessage({ id, result });
  } catch (error) {
    port.postMessage({ id, error: error.message });
  }
}

async function inspectSecurityGate(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const turnstile = document.querySelector('iframe[src*="cloudflare"], iframe[src*="turnstile"]');
      const token = document.querySelector('[name="cf-turnstile-response"]')?.value;
      return {
        hasChallenge: !!turnstile,
        type: turnstile ? "turnstile" : "none",
        solved: !!token && token.length > 0,
        token: token || null
      };
    }
  });
  return result;
}

connectNative();
