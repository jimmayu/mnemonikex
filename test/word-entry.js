// Browser checks for word entry, offline loading, private-key hiding,
// and shared secrets in high, low, and demo modes.
//   node test/word-entry.js
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");

const root = path.resolve(__dirname, "..");
const docs = path.join(root, "docs");
const chromeBin = ["/snap/bin/chromium", "/usr/bin/chromium", "/usr/bin/chromium-browser"]
  .find((bin) => fs.existsSync(bin));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const rel = decodeURIComponent(url.pathname);
    const filePath = path.normalize(path.join(docs, rel === "/" ? "index.html" : rel));
    if (!filePath.startsWith(docs)) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      const type = filePath.endsWith(".js") ? "text/javascript"
        : filePath.endsWith(".css") ? "text/css"
        : "text/html";
      res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
      res.end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function connectChrome(port) {
  let version;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) {
        version = await res.json();
        break;
      }
    } catch (err) {
      // Chrome is still starting.
    }
    await sleep(200);
  }
  if (!version) throw new Error("Chrome did not open a debug port");
  const browser = new WebSocket(version.webSocketDebuggerUrl);
  let seq = 0;
  const pending = new Map();
  browser.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  });
  await new Promise((resolve) => browser.addEventListener("open", resolve, { once: true }));
  function send(method, params = {}, sessionId) {
    const id = ++seq;
    return new Promise((resolve, reject) => {
      pending.set(id, (msg) => msg.error ? reject(new Error(method + " " + JSON.stringify(msg.error))) : resolve(msg.result));
      const payload = { id, method, params };
      if (sessionId) payload.sessionId = sessionId;
      browser.send(JSON.stringify(payload));
    });
  }
  return { browser, send };
}

async function evalPage(send, sessionId, expression) {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true }, sessionId);
  if (result.exceptionDetails) throw new Error(expression.slice(0, 80) + " -> " + JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

async function openApp(send, url) {
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sessionId);
  await send("Network.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);
  await send("Page.navigate", { url }, sessionId);
  const hosts = [];
  for (let i = 0; i < 50; i++) {
    const count = await evalPage(send, sessionId, "document.querySelectorAll('.word-input').length");
    if (count === 24) break;
    await sleep(200);
  }
  await evalPage(send, sessionId, `
    window.__alerts = [];
    window.alert = (message) => { window.__alerts.push(String(message)); };
    window.confirm = () => true;
    window.__copied = [];
    const writeText = async (text) => { window.__copied.push(String(text)); };
    if (!navigator.clipboard) navigator.clipboard = {};
    try {
      navigator.clipboard.writeText = writeText;
    } catch (err) {
      Object.defineProperty(navigator.clipboard, "writeText", { configurable: true, value: writeText });
    }
  `);
  return { sessionId, hosts };
}

function wordsOf(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean);
}

async function main() {
  if (!chromeBin) {
    console.error("FAIL  Chrome/Chromium was not found");
    process.exit(1);
  }
  const server = await startServer();
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}/`;
  const debugPort = 9340 + Math.floor(Math.random() * 200);
  const chrome = spawn(chromeBin, [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage",
    `--remote-debugging-port=${debugPort}`, "--window-size=1100,900",
    `--user-data-dir=/tmp/chrome-mnk-word-${debugPort}`, "about:blank",
  ], { stdio: "ignore" });
  const external = [];
  const checks = [];
  function check(name, ok, extra) {
    checks.push({ name, ok: !!ok });
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  " + JSON.stringify(extra)}`);
  }

  try {
    const { browser, send } = await connectChrome(debugPort);
    browser.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      const requestUrl = msg.method === "Network.requestWillBeSent" && msg.params && msg.params.request && msg.params.request.url;
      if (!requestUrl || requestUrl.startsWith("data:") || requestUrl.startsWith("about:")) return;
      const host = new URL(requestUrl).host;
      if (host !== `127.0.0.1:${port}`) external.push(requestUrl);
    });

    const page = await openApp(send, base);
    const sessionId = page.sessionId;
    await sleep(300);
    check("page makes no third-party requests", external.length === 0, external.slice(0, 5));

    const tab = await evalPage(send, sessionId, `(() => {
      const input = document.getElementById("partner-word-1");
      input.focus();
      input.value = "ac";
      input.dispatchEvent(new InputEvent("input", { bubbles: true }));
      const down = () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", keyCode: 40, which: 40, bubbles: true, cancelable: true }));
      down();
      down();
      const highlighted = input.parentElement.querySelector('li[aria-selected="true"]').textContent;
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", keyCode: 9, which: 9, bubbles: true, cancelable: true }));
      return highlighted;
    })()`);
    await sleep(50);
    const afterTab = await evalPage(send, sessionId, `({
      value: document.getElementById("partner-word-1").value,
      active: document.activeElement.id
    })`);
    check("tab inserts the highlighted word and moves on", afterTab.value === tab && afterTab.active === "partner-word-2", { tab, afterTab });

    const pasted = await evalPage(send, sessionId, `(() => {
      const input = document.getElementById("partner-word-3");
      input.focus();
      const data = new DataTransfer();
      data.setData("text/plain", "berlin bermuda notaword");
      input.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data }));
      input.blur();
      const inputs = [...document.querySelectorAll(".word-input")];
      return {
        values: inputs.slice(2, 6).map((field) => field.value),
        invalid: inputs[4].classList.contains("word-invalid"),
        active: document.activeElement.id
      };
    })()`);
    check("paste fills the following boxes", JSON.stringify(pasted.values) === JSON.stringify(["berlin", "bermuda", "notaword", ""]), pasted);
    check("a pasted unknown word is marked invalid", pasted.invalid === true);

    await evalPage(send, sessionId, `document.querySelector(".generate-keys").click()`);
    await sleep(30);
    const hidden = await evalPage(send, sessionId, `({
      shown: document.getElementById("privateKeyMnemonic").value,
      placeholder: document.getElementById("privateKeyMnemonic").placeholder,
      alerts: window.__alerts
    })`);
    check("a new private key stays hidden", hidden.shown === "" && /Hidden/.test(hidden.placeholder), hidden);
    check("creating keys does not raise an alert", hidden.alerts.length === 0, hidden.alerts);
    await evalPage(send, sessionId, `document.getElementById("togglePrivateKey").click()`);
    const revealed = await evalPage(send, sessionId, `document.getElementById("privateKeyMnemonic").value.trim().split(/\\s+/).length`);
    check("show reveals a 24-word private key", revealed === 24, revealed);
    const copied = await evalPage(send, sessionId, `(() => {
      document.getElementById("togglePrivateKey").click();
      document.querySelector('.copy-btn[data-target="privateKeyMnemonic"]').click();
      return { field: document.getElementById("privateKeyMnemonic").value, copied: window.__copied[0] || "" };
    })()`);
    await sleep(20);
    const copiedAfter = await evalPage(send, sessionId, `({
      field: document.getElementById("privateKeyMnemonic").value,
      copied: (window.__copied[0] || "").trim().split(/\\s+/).filter(Boolean).length
    })`);
    check("hide clears the field and copy still copies the key", copiedAfter.field === "" && copiedAfter.copied === 24, { copied, copiedAfter });

    async function exchange(level) {
      async function party() {
        const opened = await openApp(send, base);
        if (level !== "high") {
          await evalPage(send, opened.sessionId, `(() => {
            const select = document.getElementById("securityLevel");
            select.value = ${JSON.stringify(level)};
            select.dispatchEvent(new Event("change", { bubbles: true }));
          })()`);
        }
        await evalPage(send, opened.sessionId, `document.querySelector(".generate-keys").click()`);
        await sleep(20);
        const pub = await evalPage(send, opened.sessionId, `document.getElementById("publicKeyMnemonic").value`);
        const counts = await evalPage(send, opened.sessionId, `({
          inputs: document.querySelectorAll(".word-input").length,
          secretLabel: document.getElementById("sharedSecretHeader").textContent,
          warning: document.getElementById("demoWarning").hidden
        })`);
        return { sessionId: opened.sessionId, pub, counts };
      }
      const a = await party();
      const b = await party();
      async function accept(id, phrase) {
        await evalPage(send, id, `(() => {
          const words = ${JSON.stringify(phrase)}.trim().split(/\\s+/);
          const inputs = [...document.querySelectorAll(".word-input")];
          words.forEach((word, index) => {
            inputs[index].value = word;
            inputs[index].dispatchEvent(new Event("input", { bubbles: true }));
          });
          document.querySelector(".derive-secret").click();
        })()`);
        await sleep(30);
        return evalPage(send, id, `({
          secret: document.getElementById("sharedSecretMnemonic").value,
          password: document.getElementById("suggestedSharedPassword").value,
          alerts: window.__alerts
        })`);
      }
      return { a, b, aResult: await accept(a.sessionId, b.pub), bResult: await accept(b.sessionId, a.pub) };
    }

    const high = await exchange("high");
    check("high mode agrees on a 12-word secret", wordsOf(high.aResult.secret).length === 12 && high.aResult.secret === high.bResult.secret && high.aResult.password === high.bResult.password && high.aResult.password.length === 20, high.aResult);

    const demo = await exchange("demo");
    check("demo mode shows the warning and 12 entry boxes", demo.a.counts.inputs === 12 && demo.a.counts.warning === false && /6 words/.test(demo.a.counts.secretLabel), demo.a.counts);
    check("demo mode agrees on a 6-word secret", wordsOf(demo.aResult.secret).length === 6 && demo.aResult.secret === demo.bResult.secret && demo.aResult.alerts.length === 0, demo.aResult);

    const low = await exchange("low");
    check("low mode agrees on a 9-word secret", low.a.counts.inputs === 18 && wordsOf(low.aResult.secret).length === 9 && low.aResult.secret === low.bResult.secret, { counts: low.a.counts, secret: low.aResult.secret });

    browser.close();
    const failed = checks.filter((item) => !item.ok);
    console.log(`\n${checks.length - failed.length} passed, ${failed.length} failed`);
    chrome.kill();
    server.close();
    process.exit(failed.length ? 1 : 0);
  } catch (err) {
    console.error(err);
    chrome.kill();
    server.close();
    process.exit(1);
  }
}

main();
