/**
 * Talking to the export preview without sharing an origin.
 *
 * The HTML export preview renders the exported page in an iframe. It used to
 * be sandboxed with `allow-same-origin allow-scripts`, which lets anything
 * running inside reach the app's own window, IndexedDB and localStorage, and
 * even remove its own sandbox. It is now `allow-scripts` only: an opaque
 * origin. The parent can no longer measure the page, so a small script added
 * to the preview copy (never to the downloaded file) reports the page's
 * height and wheel movement with postMessage, and the parent accepts a
 * message only from that iframe's window carrying this preview's token.
 */

export const PREVIEW_MESSAGE_KEY = "socraticPreview";

/** Heights above this are ignored as nonsense. */
export const MAX_PREVIEW_HEIGHT = 200000;

function bridgeScript(token) {
  // The token is ours (letters, digits, "_"), but encode it anyway, and keep
  // "<" out so nothing in it could close the script element.
  const t = JSON.stringify(String(token)).replace(/</g, "\\u003c");
  return `<script>(function(){var t=${t};function s(m){m.${PREVIEW_MESSAGE_KEY}=t;parent.postMessage(m,"*");}function h(){var d=document.documentElement,b=document.body;s({height:Math.max(d?d.scrollHeight:0,b?b.scrollHeight:0)});}window.addEventListener("load",h);if(window.ResizeObserver&&document.body)new ResizeObserver(h).observe(document.body);h();window.addEventListener("wheel",function(e){s({wheel:e.deltaY});},{passive:true});})();</script>`;
}

/** `html` with the reporting script added just before `</body>` (or at the end). */
export function addPreviewBridge(html, token) {
  const source = String(html || "");
  const script = bridgeScript(token);
  const at = source.toLowerCase().lastIndexOf("</body>");
  return at === -1 ? source + script : source.slice(0, at) + script + source.slice(at);
}

/**
 * The { height?, wheel? } a message carries, or null when it is not from
 * `expectedWindow` with `token`. Numbers are checked and clamped.
 */
export function readPreviewMessage(event, expectedWindow, token) {
  if (!event || !expectedWindow || event.source !== expectedWindow) return null;
  const data = event.data;
  if (!data || typeof data !== "object" || data[PREVIEW_MESSAGE_KEY] !== token) return null;
  const out = {};
  if (Number.isFinite(data.height) && data.height >= 0) out.height = Math.min(data.height, MAX_PREVIEW_HEIGHT);
  if (Number.isFinite(data.wheel)) out.wheel = Math.max(-5000, Math.min(5000, data.wheel));
  return out;
}
