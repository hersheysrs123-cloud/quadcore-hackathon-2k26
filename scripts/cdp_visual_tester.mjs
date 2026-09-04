import fs from "fs";
import path from "path";
import { spawn } from "child_process";

async function ensureChrome() {
  try {
    const res = await fetch("http://127.0.0.1:9222/json/version");
    if (res.ok) return null;
  } catch {}

  console.log("Launching headless Chrome process...");
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const userDir = path.resolve("./tests/export_outputs/cdp_profile");

  const chromeProc = spawn(chromePath, [
    "--headless=new",
    "--remote-debugging-port=9222",
    `--user-data-dir=${userDir}`,
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check"
  ], { detached: true, stdio: "ignore" });

  chromeProc.unref();

  // Wait for port to be ready
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const res = await fetch("http://127.0.0.1:9222/json/version");
      if (res.ok) {
        console.log("Chrome CDP ready!");
        return chromeProc;
      }
    } catch {}
  }
  throw new Error("Failed to start Chrome CDP on port 9222");
}

async function runCdpCapture() {
  await ensureChrome();

  const versionRes = await fetch("http://127.0.0.1:9222/json/version");
  const versionData = await versionRes.json();

  const targetRes = await fetch("http://127.0.0.1:9222/json/new?about:blank", { method: "PUT" });
  const targetData = await targetRes.json();
  const pageWsUrl = targetData.webSocketDebuggerUrl;

  console.log("Connected to Chrome CDP page:", pageWsUrl);

  const ws = new WebSocket(pageWsUrl);

  await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));

  let reqId = 1;
  const callbacks = new Map();

  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && callbacks.has(msg.id)) {
      const cb = callbacks.get(msg.id);
      callbacks.delete(msg.id);
      if (msg.error) cb.reject(new Error(msg.error.message));
      else cb.resolve(msg.result);
    }
  });

  function send(method, params = {}) {
    const id = reqId++;
    return new Promise((resolve, reject) => {
      callbacks.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await send("Page.enable");
  await send("Runtime.enable");
  await send("DOM.enable");
  await send("CSS.enable");

  // Navigate to quantum_note.html
  const filePath = path.resolve("./tests/export_outputs/quantum_note.html").replace(/\\/g, "/");
  const fileUrl = `file:///${filePath}`;
  console.log("Navigating to:", fileUrl);

  await send("Page.navigate", { url: fileUrl });

  // Wait 3 seconds for KaTeX scripts and CDN stylesheets to render
  await new Promise((r) => setTimeout(r, 3000));

  // Set device metrics for high-res screenshot
  const evalMetrics = await send("Runtime.evaluate", {
    expression: "({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight })",
    returnByValue: true
  });

  const { width, height } = evalMetrics.result.value;
  console.log(`Document scroll dimensions: ${width} x ${height}`);

  await send("Emulation.setDeviceMetricsOverride", {
    width: Math.max(1200, width),
    height: Math.max(800, height),
    deviceScaleFactor: 2,
    mobile: false
  });

  // Capture full-page screenshot
  const screenshotRes = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: true
  });

  const screenshotBuf = Buffer.from(screenshotRes.data, "base64");
  const screenshotPath = path.resolve("./tests/export_outputs/html_visual_render.png");
  fs.writeFileSync(screenshotPath, screenshotBuf);
  console.log(`✓ Full-page HTML visual screenshot captured: ${screenshotBuf.length} bytes -> ${screenshotPath}`);

  // Generate Print to PDF
  const pdfRes = await send("Page.printToPDF", {
    printBackground: true,
    paperWidth: 8.27, // A4 inches
    paperHeight: 11.69,
    marginTop: 0.4,
    marginBottom: 0.4,
    marginLeft: 0.4,
    marginRight: 0.4
  });

  const pdfBuf = Buffer.from(pdfRes.data, "base64");
  const pdfPath = path.resolve("./tests/export_outputs/quantum_note.pdf");
  fs.writeFileSync(pdfPath, pdfBuf);
  console.log(`✓ Print PDF generated: ${pdfBuf.length} bytes -> ${pdfPath}`);

  // Evaluate visual accuracy checks inside DOM
  const visualChecks = await send("Runtime.evaluate", {
    expression: `(() => {
      const results = {};
      results.hasKatexRendered = document.querySelectorAll('.katex').length > 0;
      results.katexCount = document.querySelectorAll('.katex').length;
      results.headings = Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(h => ({ tag: h.tagName, text: h.textContent.trim() }));
      results.codeBlocks = Array.from(document.querySelectorAll('.code-block')).map(cb => ({
        langBadge: cb.querySelector('.code-lang-badge')?.textContent,
        codeLines: cb.querySelector('code')?.textContent.split('\\n').length,
        tokensHighlighted: cb.querySelectorAll('code span[style]').length
      }));
      results.tables = Array.from(document.querySelectorAll('.socratic-table')).map(t => ({
        headers: Array.from(t.querySelectorAll('th')).map(th => th.textContent.trim()),
        rowCount: t.querySelectorAll('tbody tr').length
      }));
      results.toggles = Array.from(document.querySelectorAll('details')).map(d => ({
        summary: d.querySelector('summary')?.textContent.trim(),
        isOpen: d.hasAttribute('open'),
        hasDetails: Boolean(d.querySelector('.toggle-details')?.textContent.trim())
      }));
      results.todos = Array.from(document.querySelectorAll('.todo-item')).map(td => ({
        text: td.querySelector('.todo-text')?.textContent.trim(),
        checked: td.querySelector('.todo-check')?.classList.contains('checked')
      }));
      results.callouts = Array.from(document.querySelectorAll('.callout')).map(c => c.textContent.trim());
      results.quotes = Array.from(document.querySelectorAll('blockquote')).map(q => q.textContent.trim());
      return results;
    })()`,
    returnByValue: true
  });

  console.log("\n=== Visual DOM Inspection Results ===");
  console.log(JSON.stringify(visualChecks.result.value, null, 2));

  // Close target tab and WebSocket
  try {
    await send("Target.closeTarget", { targetId: targetData.id || targetData.targetId });
  } catch {}
  ws.close();
}

runCdpCapture().catch((err) => {
  console.error("CDP Capture Error:", err);
  process.exit(1);
});
