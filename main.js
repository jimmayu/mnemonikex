// main.js
console.log("Main script started");
console.log("nobleCurves immediate check:", typeof nobleCurves);
console.log("mnemonic immediate check:", typeof mnemonic);
console.log("mn_words immediate check:", typeof mn_words);

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

window.onerror = function(msg, url, line) {
    console.error("Global error:", msg, "at line", line);
    alert("Oops! Something went wrong. Try refreshing the page or starting over.");
};

function copyToClipboard(id) {
    const textarea = document.getElementById(id);
    textarea.select();
    document.execCommand("copy");
    const button = event.target;
    button.textContent = "Copied!";
    setTimeout(() => { button.textContent = "Copy"; }, 2000);
}

function generateSuggestedPassword(sharedSecretBytes) {
    const charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    const byteLength = sharedSecretBytes.length;
    let len;
    if (byteLength === 16) {
        len = 20;
    } else {
        len = Math.max(12, Math.ceil(byteLength * 8 / 6));
    }
    console.log(`Generating password for ${byteLength} bytes, target length: ${len}`);
    for (let i = 0; i < len; i++) {
        const index = sharedSecretBytes[i % byteLength] ^ sharedSecretBytes[(i + 1) % byteLength];
        password += charSet[index % charSet.length];
    }
    if (password.length !== len) {
        password = password.slice(0, len);
    }
    return password;
}

function updateWordCount() {
    const inputs = document.querySelectorAll("#partnerKeyInputs .word-input");
    const filledWords = Array.from(inputs).filter(input => input.value.trim().length > 0).length;
    document.getElementById("wordCount").textContent = `Words entered: ${filledWords}/${wordCount}`;
    inputs.forEach(input => {
        if (input.value.trim().length > 0 && !mn_words.slice(1).includes(input.value.trim().toLowerCase())) {
            input.style.borderColor = "#ff4444";
        } else {
            input.style.borderColor = "";
        }
    });
}

// ————————————————————————————————————————
// UPDATE INPUT FIELDS – CORRECT LAYOUT
// ————————————————————————————————————————
function updateInputFields() {
    const inputContainer = document.getElementById("partnerKeyInputs");
    inputContainer.innerHTML = '';
    console.log("Updating input fields for", wordCount, "words");

    for (let i = 0; i < wordCount; i++) {
        const pair = document.createElement("div");
        pair.className = "word-pair";

        const label = document.createElement("label");
        label.textContent = `${i + 1}:`;
        label.className = "word-num";
        label.setAttribute("aria-label", `Word number ${i + 1}`);

        const input = document.createElement("input");
        input.type = "text";
        input.className = "word-input";
        input.maxLength = 7;
        input.setAttribute("aria-label", `Enter word ${i + 1}`);
        input.addEventListener("input", updateWordCount);

        pair.appendChild(label);
        pair.appendChild(input);
        inputContainer.appendChild(pair);

        // ——— AWESOMPLETE (NO TAB FIX) ———
        new Awesomplete(input, {
            list: mn_words.slice(1),
            minChars: 2,
            maxItems: 5,
            autoFirst: true,
            filter: (text, input) => text.toLowerCase().startsWith(input.toLowerCase())
        });
    }

    console.log("Created", wordCount, "input pairs");
    document.getElementById("wordCount").textContent = `Words entered: 0/${wordCount}`;
    document.getElementById("publicKeyHeader").textContent = `Your Public ${mode === 'demo' ? 'Key' : 'Address'} (${wordCount} words)`;
    document.getElementById("privateKeyHeader").textContent = mode === 'demo' ? "Your Private Key (hidden in demo mode)" : `Your Private Key (${wordCount} words)`;
    document.getElementById("partnerKeyHeader").textContent = `Enter Your Friend’s Public ${mode === 'demo' ? 'Key' : 'Address'} (${wordCount} words)`;
    document.getElementById("sharedSecretHeader").textContent = "Your Secret Code (12 words)";
}

// Global variables
let keySizeBytes = 32;
let wordCount = 24;
let mode = 'high';
let privateKey;

// ————————————————————————————————————————
// DOM LOADED – MAIN SETUP
// ————————————————————————————————————————
document.addEventListener("DOMContentLoaded", function() {
    try {
        console.log("DOMContentLoaded fired");

        if (typeof nobleCurves === "undefined") throw new Error("noble-curves.js not loaded");
        if (typeof mnemonic === "undefined") throw new Error("mnemonic.js not loaded");
        if (typeof mn_words === "undefined") throw new Error("mn_words not defined");
        if (typeof Awesomplete === "undefined") throw new Error("Awesomplete not loaded");

        console.log("All dependencies loaded");

        updateInputFields();

        document.getElementById('securityLevel').addEventListener('change', () => {
            const val = event.target.value;
            mode = val;
            keySizeBytes = val === 'demo' ? 16 : (val === 'low' ? 24 : 32);
            wordCount = val === 'demo' ? 12 : (val === 'low' ? 18 : 24);
            updateInputFields();
            document.getElementById('demoWarning').style.display = val === 'demo' ? 'block' : 'none';
        });

        window.toggleTheme = function() {
            document.body.classList.toggle("light-mode");
            const button = document.querySelector("button[onclick='toggleTheme()']");
            button.textContent = document.body.classList.contains("light-mode")
                ? "Switch to Dark Mode"
                : "Switch to Light Mode";
        };

        window.generateKeys = function() {
            const loading = document.querySelector("button[onclick='generateKeys()'] .loading");
            loading.style.display = "inline";
            console.log("Generating keypair...");

            try {
                if (mode === 'demo' || mode === 'low') {
                    const len = mode === 'demo' ? 16 : 24;
                    const privBytes = crypto.getRandomValues(new Uint8Array(len));
                    privateKey = bytesToBigInt(privBytes);
                    const p = mode === 'demo' ? DH_PARAMS.p : LOW_DH_P;
                    const pub = modPow(DH_PARAMS.g, privateKey, p);
                    const pubBytes = bigIntToBytes(pub, len);
                    const pubMnemonic = mnemonic.encode([...pubBytes], "x ");
                    document.getElementById("publicKeyMnemonic").value = pubMnemonic;
                    document.getElementById("privateKeyMnemonic").value = "Hidden (" + mode + " mode)";
                } else {
                    // Existing ECDH logic
                    const curve = nobleCurves.x25519;
                    privateKey = curve.utils.randomPrivateKey();
                    const publicKey = curve.getPublicKey(privateKey);
                    const pubKeyMnemonic = mnemonic.encode([...publicKey], "x ");
                    const privKeyMnemonic = mnemonic.encode([...privateKey], "x ");
                    document.getElementById("publicKeyMnemonic").value = pubKeyMnemonic;
                    document.getElementById("privateKeyMnemonic").value = privKeyMnemonic;
                }
                loading.style.display = "none";
                console.log("Keys generated and displayed");
            } catch (err) {
                console.error("generateKeys error:", err);
                alert("Failed to generate keys. Try again.");
                loading.style.display = "none";
            }
        };

        window.deriveSharedSecret = function() {
            const confirmed = confirm("Have you confirmed your friend’s voice over a call? Press OK to continue.");
            if (!confirmed) return;

            const loading = document.querySelector("button[onclick='deriveSharedSecret()'] .loading");
            loading.style.display = "inline";

            try {
                if (!privateKey) {
                    alert("Create your codes first!");
                    loading.style.display = "none";
                    return;
                }

                const inputs = document.querySelectorAll("#partnerKeyInputs .word-input");
                const words = Array.from(inputs)
                    .map(i => i.value.trim())
                    .filter(w => w.length > 0);

                if (words.length !== wordCount) {
                    alert(`Please enter all ${wordCount} words.`);
                    loading.style.display = "none";
                    return;
                }

                const validWords = new Set(mn_words.slice(1));
                const invalid = words.filter(w => !validWords.has(w.toLowerCase()));
                if (invalid.length > 0) {
                    alert(`Invalid words: ${invalid.join(", ")}`);
                    loading.style.display = "none";
                    return;
                }

                const partnerKeyBytes = mnemonic.decode(words.join(" "));
                if (partnerKeyBytes.length !== keySizeBytes) {
                    throw new Error(`Partner key must be ${keySizeBytes} bytes`);
                }

                let sharedSecretShort;
                if (mode === 'demo' || mode === 'low') {
                    const len = mode === 'demo' ? 16 : 24;
                    const p = mode === 'demo' ? DH_PARAMS.p : LOW_DH_P;
                    const partnerPub = bytesToBigInt(partnerKeyBytes);
                    const shared = modPow(partnerPub, privateKey, p);
                    const sharedBytes = bigIntToBytes(shared, len);
                    sharedSecretShort = sharedBytes.slice(0, 16);
                } else {
                    // Existing ECDH logic
                    const curve = nobleCurves.x25519;
                    const partnerKey = new Uint8Array(partnerKeyBytes);
                    const sharedSecretFull = curve.getSharedSecret(privateKey, partnerKey);
                    sharedSecretShort = sharedSecretFull.slice(0, 16);
                }

                const sharedMnemonic = mnemonic.encode([...sharedSecretShort], "x ");
                const password = generateSuggestedPassword(sharedSecretShort);

                document.getElementById("sharedSecretMnemonic").value = sharedMnemonic;
                document.getElementById("suggestedSharedPassword").value = password;
                document.getElementById("sharedSecretHeader").textContent = "Your Secret Code (12 words)";

                loading.style.display = "none";
                console.log("Shared secret generated");
            } catch (err) {
                console.error("deriveSharedSecret error:", err);
                alert("Invalid public key. Check the words and try again.");
                loading.style.display = "none";
            }
        };

    } catch (error) {
        console.error("Setup error:", error);
        alert("App failed to start: " + error.message);
    }
});
