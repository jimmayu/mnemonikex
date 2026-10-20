// Static checks for the current docs/ app. Run from the repo root:
//   node test/verify-code.js
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.resolve(__dirname, "..");
const mainJs = fs.readFileSync(path.join(root, "docs/main.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "docs/index.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "docs/styles.css"), "utf8");
const curvePath = path.join(root, "docs/noble-curves.js");

const checks = [];
function check(name, ok) {
  checks.push({ name, ok: !!ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
}

check("curve import is local", mainJs.includes("from './noble-curves.js'"));
check("no runtime esm.sh import", !mainJs.includes("esm.sh"));
const blockedStylesheetHosts = new Set(["fonts.googleapis.com"]);
const stylesheetHrefRegex = /<link\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi;
let hasBlockedStylesheetHost = false;
let match;
while ((match = stylesheetHrefRegex.exec(indexHtml)) !== null) {
  const rawHref = match[1].trim();
  const normalizedHref = rawHref.startsWith("//") ? `https:${rawHref}` : rawHref;
  try {
    const parsed = new URL(normalizedHref);
    if (blockedStylesheetHosts.has(parsed.hostname)) {
      hasBlockedStylesheetHost = true;
      break;
    }
  } catch {
    // Ignore invalid/relative hrefs; this check targets explicit external hosts.
  }
}
check("no Google Fonts stylesheet", !hasBlockedStylesheetHost);
check("page font is a system stack", styles.includes("system-ui"));
check("copy uses the clipboard API", mainJs.includes("navigator.clipboard.writeText"));
check("clipboard failure can fall back", mainJs.includes("copyWithExecCommand"));
check("demo secret is 6 words / 8 bytes", /mode === "demo"\) return 6/.test(mainJs) && /mode === "demo"\) return 8/.test(mainJs));
check("low secret is 9 words / 12 bytes", /mode === "low"\) return 9/.test(mainJs) && /mode === "low"\) return 12/.test(mainJs));
check("weak-mode alert stack is gone", !mainJs.includes("LAST WARNING") && !mainJs.includes("You selected"));
check("weak mode still asks before switching", mainJs.includes("Switch to it?"));
check("private key can be shown and hidden", indexHtml.includes('id="togglePrivateKey"') && mainJs.includes("privateKeyHidden"));
check("secret length is written into the page copy", indexHtml.includes('data-count="secret"') && indexHtml.includes('data-count="public"'));

(async () => {
  const curve = await import(pathToFileURL(curvePath).href);
  check("local bundle exports x25519", typeof curve.x25519?.getPublicKey === "function" && typeof curve.x25519?.getSharedSecret === "function");
  const failed = checks.filter((item) => !item.ok);
  console.log(`\n${checks.length - failed.length} passed, ${failed.length} failed`);
  process.exit(failed.length ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
