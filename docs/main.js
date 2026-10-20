// main.js (ES Module version)
console.log("Main script started");

import { x25519 } from './noble-curves.js';

// Weak DH parameters for educational/demo purposes ONLY - DO NOT USE FOR SECURE COMMUNICATIONS
const DH_PARAMS = { p: 2n ** 128n - 159n, g: 2n };
const LOW_DH_P = 2n ** 192n - 2n ** 64n - 1n; // Approximate 192-bit prime for low mode

function modPow(base, exp, mod) {
  let res = 1n;
  base = base % mod;
  while (exp > 0n) {
    if (exp & 1n) res = (res * base) % mod;
    base = (base * base) % mod;
    exp >>= 1n;
  }
  return res;
}

function bigIntToBytes(n, len) {
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[len - 1 - i] = Number(n & 255n);
    n >>= 8n;
  }
  return bytes;
}

function bytesToBigInt(bytes) {
  return bytes.reduce((n, b) => (n << 8n) | BigInt(b), 0n);
}

function getMnemonicFormat(wordCount) {
  const group = "x x x ";
  const numGroups = wordCount / 3;
  return group.repeat(numGroups);
}

function sharedSecretWordCount() {
  if (mode === "demo") return 6;
  if (mode === "low") return 9;
  return 12;
}

function sharedSecretByteLength() {
  if (mode === "demo") return 8;
  if (mode === "low") return 12;
  return 16;
}

window.onerror = function(msg, url, line) {
    console.error("Global error:", msg, "at line", line);
    alert("Oops! Something went wrong. Try refreshing the page or starting over.");
};

function textForCopy(id) {
    if (id === "privateKeyMnemonic") return privateKeyText;
    const field = document.getElementById(id);
    return field ? field.value : "";
}

function copyWithExecCommand(text) {
    const helper = document.createElement("textarea");
    helper.value = text;
    helper.setAttribute("readonly", "");
    helper.style.position = "fixed";
    helper.style.left = "-9999px";
    document.body.appendChild(helper);
    helper.select();
    let copied = false;
    try {
        copied = document.execCommand("copy");
    } catch (err) {
        copied = false;
    }
    helper.remove();
    return copied;
}

async function copyToClipboard(id) {
    const button = document.querySelector(`.copy-btn[data-target="${id}"]`);
    const text = textForCopy(id);
    const originalText = button ? button.textContent : "";
    if (!text) {
        if (button) {
            button.textContent = "Nothing to copy";
            setTimeout(() => { button.textContent = originalText; }, 2000);
        }
        return;
    }
    let copied = false;
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            copied = true;
        }
    } catch (err) {
        copied = false;
    }
    if (!copied) copied = copyWithExecCommand(text);
    if (button) {
        button.textContent = copied ? "Copied!" : "Copy failed";
        setTimeout(() => { button.textContent = originalText; }, 2000);
    }
}
window.copyToClipboard = copyToClipboard;

function generateSuggestedPassword(sharedSecretBytes) {
    const charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    const byteLength = sharedSecretBytes.length;
    let len = (byteLength === 16) ? 20 : Math.max(12, Math.ceil(byteLength * 8 / 6));
    
    for (let i = 0; i < len; i++) {
        const index = sharedSecretBytes[i % byteLength] ^ sharedSecretBytes[(i + 1) % byteLength];
        password += charSet[index % charSet.length];
    }
    return password.slice(0, len);
}

let awesompletes = [];
let validWords = new Set();

function partnerInputs() {
    return Array.from(document.querySelectorAll("#partnerKeyInputs .word-input"));
}

function isValidWord(value) {
    return validWords.has(value.trim().toLowerCase());
}

function updateWordCount() {
    const valid = partnerInputs().filter(input => isValidWord(input.value)).length;
    document.getElementById("wordCount").textContent = `${valid} valid / ${wordCount}`;
}

function markIfInvalid(input) {
    const value = input.value.trim();
    const invalid = value.length > 0 && !isValidWord(value);
    input.classList.toggle("word-invalid", invalid);
    input.setAttribute("aria-invalid", invalid ? "true" : "false");
}

function focusPartnerInput(input) {
    const inputs = partnerInputs();
    const next = inputs[inputs.indexOf(input) + 1];
    if (next) next.focus();
}

function placeWord(input, word) {
    if (word.length > input.maxLength) input.maxLength = word.length;
    input.value = word;
}

// Replace only the "(N words)" text so the tooltip and Copy button stay put.
function setHeadingWordCount(id, count) {
    const heading = document.getElementById(id);
    const node = heading && heading.firstChild;
    if (node && node.nodeType === Node.TEXT_NODE) {
        node.nodeValue = node.nodeValue.replace(/\(\d+ words\)/, `(${count} words)`);
    }
}

function updateInputFields() {
    awesompletes.forEach(widget => widget.destroy());
    awesompletes = [];

    const wordList = mn_words.slice(1);
    validWords = new Set(wordList);

    const inputContainer = document.getElementById("partnerKeyInputs");
    inputContainer.innerHTML = "";
    for (let i = 0; i < wordCount; i++) {
        const pair = document.createElement("div");
        pair.className = "word-pair";

        const label = document.createElement("label");
        label.textContent = `${i + 1}:`;
        label.className = "word-num";
        label.htmlFor = `partner-word-${i + 1}`;

        const input = document.createElement("input");
        input.type = "text";
        input.id = `partner-word-${i + 1}`;
        input.className = "word-input";
        input.maxLength = 7;
        input.setAttribute("aria-label", `Word ${i + 1}`);
        input.setAttribute("spellcheck", "false");
        input.setAttribute("autocapitalize", "none");
        input.setAttribute("autocorrect", "off");
        input.setAttribute("autocomplete", "off");
        input.setAttribute("enterkeyhint", "next");

        input.addEventListener("input", () => {
            input.classList.remove("word-invalid");
            input.setAttribute("aria-invalid", "false");
            updateWordCount();
        });
        input.addEventListener("blur", () => {
            markIfInvalid(input);
            updateWordCount();
        });
        input.addEventListener("keydown", (event) => {
            if (event.key !== "Enter" && event.key !== "Tab") return;
            if (event.key === "Tab" && event.shiftKey) return;
            const openMenu = input.parentElement.querySelector("ul:not([hidden])");
            const selected = openMenu && openMenu.querySelector('li[aria-selected="true"]');
            if (selected) {
                if (event.key === "Tab") {
                    event.preventDefault();
                    const widget = awesompletes.find(item => item.input === input);
                    if (widget) widget.select();
                }
                return;
            }
            if (event.key === "Enter" && isValidWord(input.value)) {
                event.preventDefault();
                focusPartnerInput(input);
            }
        });
        input.addEventListener("paste", (event) => {
            const text = event.clipboardData ? event.clipboardData.getData("text") : "";
            const parts = text.trim().split(/[^A-Za-z]+/).filter(Boolean).map(word => word.toLowerCase());
            if (parts.length === 0) return;
            event.preventDefault();
            if (parts.length === 1) {
                placeWord(input, parts[0]);
                input.dispatchEvent(new Event("input", { bubbles: true }));
                return;
            }
            const inputs = partnerInputs();
            const start = inputs.indexOf(input);
            parts.forEach((word, offset) => {
                const target = inputs[start + offset];
                if (!target) return;
                placeWord(target, word);
                markIfInvalid(target);
            });
            updateWordCount();
            const next = inputs[start + parts.length] || inputs[inputs.length - 1];
            next.focus();
        });
        input.addEventListener("awesomplete-selectcomplete", () => {
            input.classList.remove("word-invalid");
            input.setAttribute("aria-invalid", "false");
            updateWordCount();
            const current = input;
            requestAnimationFrame(() => focusPartnerInput(current));
        });

        pair.appendChild(label);
        pair.appendChild(input);
        inputContainer.appendChild(pair);

        awesompletes.push(new Awesomplete(input, {
            list: wordList,
            minChars: 1,
            maxItems: 10,
            autoFirst: false,
            filter: (text, typed) => String(text).toLowerCase().startsWith(String(typed).toLowerCase()),
            sort: (a, b) => String(a).localeCompare(String(b))
        }));
    }

    setHeadingWordCount("publicKeyHeader", wordCount);
    setHeadingWordCount("privateKeyHeader", wordCount);
    setHeadingWordCount("partnerKeyHeader", wordCount);
    setHeadingWordCount("sharedSecretHeader", sharedSecretWordCount());
    document.querySelectorAll("[data-count='public']").forEach((el) => {
        el.textContent = String(wordCount);
    });
    document.querySelectorAll("[data-count='secret']").forEach((el) => {
        el.textContent = String(sharedSecretWordCount());
    });
    const partnerTip = document.querySelector("#partnerKeyHeader .tooltiptext");
    if (partnerTip) {
        partnerTip.textContent = partnerTip.textContent.replace(/\d+ words/, `${wordCount} words`);
    }
    updateWordCount();
}

// Global variables for security mode management
let keySizeBytes = 32;
let wordCount = 24;
let mode = 'high';  // Default to high security - users must explicitly choose weak modes
let privateKey;
let privateKeyText = "";
let privateKeyHidden = true;

function renderPrivateKey() {
    const field = document.getElementById("privateKeyMnemonic");
    const button = document.getElementById("togglePrivateKey");
    const hasKey = privateKeyText.length > 0;
    if (privateKeyHidden || !hasKey) {
        field.value = "";
        field.placeholder = hasKey ? "Hidden. Show reveals it on this screen." : "";
    } else {
        field.value = privateKeyText;
        field.placeholder = "";
    }
    button.disabled = !hasKey;
    button.textContent = privateKeyHidden ? "Show" : "Hide";
    button.setAttribute("aria-pressed", privateKeyHidden ? "false" : "true");
}

function setPrivateKeyText(text) {
    privateKeyText = text;
    if (!text) privateKeyHidden = true;
    renderPrivateKey();
}

function togglePrivateKeyVisibility() {
    if (!privateKeyText) return;
    privateKeyHidden = !privateKeyHidden;
    renderPrivateKey();
}

function clearGeneratedSecrets() {
    document.getElementById("publicKeyMnemonic").value = "";
    setPrivateKeyText("");
    document.getElementById("suggestedSharedPassword").value = "";
    document.getElementById("sharedSecretMnemonic").value = "";
    privateKey = undefined;
}

function showModeWarning(val) {
    const warning = document.getElementById("demoWarning");
    if (val === "demo") {
        warning.hidden = false;
        warning.textContent = "Demo mode uses 128-bit cryptography (12 public words, 6 secret words). Do not use it for confidential communications. It is here for learning and testing.";
    } else if (val === "low") {
        warning.hidden = false;
        warning.textContent = "Low mode uses 192-bit cryptography (18 public words, 9 secret words). Do not use it for confidential communications. It is here for testing.";
    } else {
        warning.hidden = true;
        warning.textContent = "";
    }
}

function applySecurityMode(val) {
    mode = val;
    keySizeBytes = val === "demo" ? 16 : (val === "low" ? 24 : 32);
    wordCount = val === "demo" ? 12 : (val === "low" ? 18 : 24);
    updateInputFields();
    showModeWarning(val);
    clearGeneratedSecrets();
}

function toggleTheme() {
    document.body.classList.toggle("light-mode");
    const button = document.querySelector(".toggle-theme");
    button.textContent = document.body.classList.contains("light-mode")
        ? "Switch to Dark Mode"
        : "Switch to Light Mode";
}

function generateKeys() {
    const loading = document.querySelector(".generate-keys .loading");
    if (loading) loading.style.display = "inline";

    console.log("Generating keypair...");
    try {
        if (mode === "demo" || mode === "low") {
            const len = mode === "demo" ? 16 : 24;
            const prime = mode === "demo" ? DH_PARAMS.p : LOW_DH_P;
            const privBytes = crypto.getRandomValues(new Uint8Array(len));
            privateKey = bytesToBigInt(privBytes);
            const pubBytes = bigIntToBytes(modPow(DH_PARAMS.g, privateKey, prime), len);
            document.getElementById("publicKeyMnemonic").value = mnemonic.encode([...pubBytes], getMnemonicFormat(wordCount));
            setPrivateKeyText(mnemonic.encode([...privBytes], getMnemonicFormat(wordCount)));
        } else {
            privateKey = crypto.getRandomValues(new Uint8Array(32));
            privateKey[0] &= 248;
            privateKey[31] &= 127;
            privateKey[31] |= 64;
            const publicKey = x25519.getPublicKey(privateKey);
            document.getElementById("publicKeyMnemonic").value = mnemonic.encode([...publicKey], getMnemonicFormat(wordCount));
            setPrivateKeyText(mnemonic.encode([...privateKey], getMnemonicFormat(wordCount)));
        }
        if (loading) loading.style.display = "none";
        console.log("Keys generated and displayed");
    } catch (err) {
        console.error("generateKeys error:", err);
        alert("Failed to generate keys. Try again.");
        if (loading) loading.style.display = "none";
    }
}

function deriveSharedSecret() {
    const confirmed = confirm("Have you confirmed your friend’s voice over a call? Press OK to continue.");
    if (!confirmed) return;
    
    const loading = document.querySelector(".derive-secret .loading");
    if (loading) loading.style.display = "inline";
    
    try {
        if (!privateKey) {
            alert("Create your codes first!");
            if (loading) loading.style.display = "none";
            return;
        }
        
        const inputs = document.querySelectorAll("#partnerKeyInputs .word-input");
        const words = Array.from(inputs)
            .map(i => i.value.trim())
            .filter(w => w.length > 0);
            
        if (words.length !== wordCount) {
            alert(`Please enter all ${wordCount} words.`);
            if (loading) loading.style.display = "none";
            return;
        }
        
        const validWords = new Set(mn_words.slice(1));
        const invalid = words.filter(w => !validWords.has(w.toLowerCase()));
        if (invalid.length > 0) {
            alert(`Invalid words: ${invalid.join(", ")}`);
            if (loading) loading.style.display = "none";
            return;
        }
        
        const partnerKeyBytes = mnemonic.decode(words.join(" "));
        if (partnerKeyBytes.length !== keySizeBytes) {
            throw new Error(`Partner key must be ${keySizeBytes} bytes`);
        }

        let sharedBytes;
        if (mode === "demo" || mode === "low") {
            const len = mode === "demo" ? 16 : 24;
            const prime = mode === "demo" ? DH_PARAMS.p : LOW_DH_P;
            const shared = modPow(bytesToBigInt(partnerKeyBytes), privateKey, prime);
            sharedBytes = bigIntToBytes(shared, len);
        } else {
            sharedBytes = x25519.getSharedSecret(privateKey, new Uint8Array(partnerKeyBytes));
        }
        const sharedSecretShort = sharedBytes.slice(0, sharedSecretByteLength());
        const sharedMnemonic = mnemonic.encode([...sharedSecretShort], getMnemonicFormat(sharedSecretWordCount()));
        const password = generateSuggestedPassword(sharedSecretShort);
        
        document.getElementById("sharedSecretMnemonic").value = sharedMnemonic;
        document.getElementById("suggestedSharedPassword").value = password;
        
        if (loading) loading.style.display = "none";
        console.log("Shared secret generated");
    } catch (err) {
        console.error("deriveSharedSecret error:", err);
        alert("Invalid public key. Check the words and try again.");
        if (loading) loading.style.display = "none";
    }
}

function initializeApp() {
    try {
        console.log("Initializing app");
        if (typeof mnemonic === "undefined") throw new Error("mnemonic.js not loaded");
        if (typeof mn_words === "undefined") throw new Error("mn_words not defined");
        if (typeof Awesomplete === "undefined") throw new Error("Awesomplete not loaded");
        
        updateInputFields();
        
        // Event listeners
        document.querySelector(".toggle-theme").addEventListener("click", toggleTheme);
        document.querySelector(".generate-keys").addEventListener("click", generateKeys);
        document.querySelector(".derive-secret").addEventListener("click", deriveSharedSecret);
        document.getElementById("togglePrivateKey").addEventListener("click", togglePrivateKeyVisibility);
        renderPrivateKey();
        
        // Copy buttons using data-target
        document.querySelectorAll(".copy-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const targetId = btn.getAttribute("data-target");
                if (targetId) copyToClipboard(targetId);
            });
        });

        // Security level change handler - with clear warnings for weak modes
        document.getElementById("securityLevel").addEventListener("change", (e) => {
            const val = e.target.value;
            if (val === mode) return;
            if (val !== "high") {
                const label = val === "demo" ? "Demo" : "Low";
                const ok = confirm(`${label} mode uses weak cryptography and is only for learning or testing. Switch to it?`);
                if (!ok) {
                    e.target.value = mode;
                    return;
                }
            }
            applySecurityMode(val);
        });

        showModeWarning("high");
        console.log("App initialized successfully");
    } catch (error) {
        console.error("Setup error:", error);
        alert("App failed to start: " + error.message);
    }
}

document.addEventListener('DOMContentLoaded', initializeApp);
