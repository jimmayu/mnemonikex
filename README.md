# MnemoNiKex — Mnemonic Key Exchange

**[Live Demo](https://jimmayu.github.io/mnemonikex)**

A browser-based tool that lets two people establish a shared secret over an untrusted channel using only their voices. Built on X25519 Elliptic Curve Diffie-Hellman with human-readable mnemonic word encoding.

## What It Does

MnemoNiKex solves a real problem: how do two people who trust each other's voices (but not their network) agree on a secret encryption key?

1. **Each person generates a keypair.** Their public key is encoded as 24 pronounceable words.
2. **They call each other** and read those 24 words aloud. The caller's voice acts as authentication — it's very hard to impersonate in real time.
3. **Each person types in their partner's 24 words.** The app performs ECDH key agreement.
4. **Both sides arrive at the same shared secret** — expressed as 12 words *and* a 20-character password.

No servers. No accounts. No installation. Just open `public/index.html` in a browser.

## How to Use

1. Open `public/index.html` in any modern browser
2. Click **Create My Codes** — this generates your X25519 keypair
3. Read your **Public Address** (24 words) to your partner over a voice call
4. Type your partner's 24 words into the numbered input fields (auto-complete helps)
5. Click **Create Secret Code** and confirm you recognized your partner's voice
6. You and your partner now share the same 12-word secret + password

## Features

- **X25519 ECDH** — industry-standard elliptic curve key agreement (256-bit security)
- **Mnemonic encoding** — 24-word public keys from a 1,633-word list, easy to read aloud and type
- **Auto-complete input** — word fields complete from the official wordlist, with red borders on invalid words
- **Dual output formats** — 12-word mnemonic and a 20-character password (same underlying secret)
- **Voice verification prompt** — confirms you recognized your partner before revealing the secret
- **Dark/light mode** — toggle in the top corner
- **Fully client-side** — no network requests, no server, no data leaves your device

## Security Modes

| Mode | Key Size | Words | Use Case |
|------|----------|-------|----------|
| **High** (default) | 256-bit | 24 public / 12 secret | Real use — X25519 ECDH |
| Low | 192-bit | 18 public / 9 secret | Testing only — weak DH parameters |
| Demo | 128-bit | 12 public / 6 secret | Educational only — intentionally weak |

> **Warning:** Low and Demo modes use weak Diffie-Hellman parameters and are not cryptographically secure. They exist for learning and testing. The app shows explicit warnings and requires confirmation before using them.

## Security Model

- **What protects you:** X25519 ECDH ensures that sharing your public key (even openly) reveals nothing about the shared secret. Only someone holding your private key can derive it.
- **What your voice adds:** Cryptography alone can't tell you *who* sent the public key. Reading the 24 words over a live voice call lets your partner verify it's really you — defeating man-in-the-middle attacks.
- **What isn't protected:** If an attacker can convincingly impersonate your partner's voice in real time, the security guarantee is broken. Use video calls or other out-of-band verification for high-stakes cases.

The private key never leaves your browser. There is no backend.

## Project Layout

```
public/
  index.html          Main application
  main.js             Application logic (key gen, ECDH, UI)
  mnemonic.js         Mnemonic encode/decode (Oren Tirosh / Matt Brubeck)
  mn_words.js         1,633-word mnemonic wordlist
  noble-curves.js     X25519 implementation (@noble/curves)
  styles.css          Responsive dark/light styles
  awesomplete-gh-pages/  Auto-complete library
test/                 Static analysis and test utilities
archive/              Earlier single-file iterations (dh.html → dh6)
```

## Running Locally

No build step required. Open `public/index.html` directly in a browser, or serve the `public/` directory with any static file server:

```bash
python3 -m http.server 8080 --directory public
# then open http://localhost:8080
```

## Credits

- Mnemonic codec based on work by [Oren Tirosh](https://tothink.com/mnemonic/) (2000) and Matt Brubeck (2014)
- X25519 via [noble-curves](https://github.com/paulmillr/noble-curves) by Paul Miller
- Auto-complete via [Awesomplete](https://leaverou.github.io/awesomplete/) by Lea Verou

## License

MIT
