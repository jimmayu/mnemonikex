// main.js (ES Module version)
console.log("Main script started");

// Reliable import for @noble/curves that resolves internal dependencies correctly
import { x25519 } from 'https://esm.sh/@noble/curves@1/ed25519.js';



function getMnemonicFormat(wordCount) {
  const group = "x x x ";
  const numGroups = wordCount / 3;
  return group.repeat(numGroups);
}

window.onerror = function(msg, url, line) {
    console.error("Global error:", msg, "at line", line);
    alert("Oops! Something went wrong. Try refreshing the page or starting over.");
};

// Exposed globally for copy buttons
function copyToClipboard(id) {
    const textarea = document.getElementById(id);
    textarea.select();
    document.execCommand("copy");
    
    // Find the button that triggered this (via data-target)
    const button = document.querySelector(`.copy-btn[data-target="${id}"]`);
    if (button) {
        const originalText = button.textContent;
        button.textContent = "Copied!";
        setTimeout(() => { button.textContent = originalText; }, 2000);
    }
}
window.copyToClipboard = copyToClipboard; // Make available globally

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

function updateInputFields() {
    const inputContainer = document.getElementById("partnerKeyInputs");
    inputContainer.innerHTML = '';
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
        
        new Awesomplete(input, {
            list: mn_words.slice(1),
            minChars: 2,
            maxItems: 5,
            autoFirst: true,
            filter: (text, input) => text.toLowerCase().startsWith(input.toLowerCase()),
            emptyMsg: ""
        });
    }
    document.getElementById("wordCount").textContent = `Words entered: 0/${wordCount}`;
    document.getElementById("publicKeyHeader").textContent = `Your Public Address (${wordCount} words)`;
    document.getElementById("privateKeyHeader").textContent = `Your Private Key (${wordCount} words)`;
    document.getElementById("partnerKeyHeader").textContent = `Enter Your Buddy's Public Address (${wordCount} words)`;
    document.getElementById("sharedSecretHeader").textContent = "Your Secret Code (12 words)";
}

// Global variables - Always use high security X25519
let keySizeBytes = 32;
let wordCount = 24;
let privateKey;

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
        // Only allow secure X25519 key generation
        privateKey = crypto.getRandomValues(new Uint8Array(32));
        privateKey[0] &= 248;
        privateKey[31] &= 127;
        privateKey[31] |= 64;
        const publicKey = x25519.getPublicKey(privateKey);
        const pubKeyMnemonic = mnemonic.encode([...publicKey], getMnemonicFormat(wordCount));
        const privKeyMnemonic = mnemonic.encode([...privateKey], getMnemonicFormat(wordCount));
        document.getElementById("publicKeyMnemonic").value = pubKeyMnemonic;
        document.getElementById("privateKeyMnemonic").value = privKeyMnemonic;
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
        
        // Only use secure X25519 key derivation
        const partnerKey = new Uint8Array(partnerKeyBytes);
        const sharedSecretFull = x25519.getSharedSecret(privateKey, partnerKey);
        const sharedSecretShort = sharedSecretFull.slice(0, 16);
        
        const sharedMnemonic = mnemonic.encode([...sharedSecretShort], getMnemonicFormat(12));
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
        
        // Copy buttons using data-target
        document.querySelectorAll(".copy-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const targetId = btn.getAttribute("data-target");
                if (targetId) copyToClipboard(targetId);
            });
        });
        console.log("App initialized successfully");
    } catch (error) {
        console.error("Setup error:", error);
        alert("App failed to start: " + error.message);
    }
}

document.addEventListener('DOMContentLoaded', initializeApp);
