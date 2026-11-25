import test from "node:test";
import assert from "node:assert/strict";
import {
  DEVICE_CHALLENGE_TTL_MS,
  bytesToBase64Url,
  createDeviceChallenge,
  deviceSignMessage,
  importDevicePublicKey,
  readDeviceChallenge,
  sha256Hex,
  verifyDeviceSignature,
} from "@/lib/auth/device-crypto";

// Read lazily by device-crypto, so setting it here is early enough.
process.env.JWT_SALT ??= "test-secret-for-device-crypto";

/** What the browser does in lib/device/device-key.ts, minus IndexedDB. */
async function makeBrowserKey() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, [
    "sign",
    "verify",
  ]);
  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey));
  return { pair, publicKey: bytesToBase64Url(spki), keyId: await sha256Hex(spki) };
}

async function sign(key: CryptoKey, purpose: "login" | "register", challenge: string) {
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(deviceSignMessage(purpose, challenge)),
  );
  return bytesToBase64Url(new Uint8Array(sig));
}

test("a fresh challenge reads back with its issue time", async () => {
  const now = Date.now();
  const challenge = await createDeviceChallenge(now);
  assert.equal((await readDeviceChallenge(challenge, now + 1000))?.getTime(), now);
});

test("a tampered challenge is refused", async () => {
  const now = Date.now();
  const [issued, nonce, mac] = (await createDeviceChallenge(now)).split(".");
  assert.equal(await readDeviceChallenge(`${issued}.${nonce}x.${mac}`, now), null);
  assert.equal(await readDeviceChallenge(`${Number(issued) + 1}.${nonce}.${mac}`, now), null);
  assert.equal(await readDeviceChallenge("garbage", now), null);
});

test("an expired challenge is refused", async () => {
  const now = Date.now();
  const challenge = await createDeviceChallenge(now);
  assert.equal(await readDeviceChallenge(challenge, now + DEVICE_CHALLENGE_TTL_MS + 1), null);
});

test("the server verifies a signature made by the browser key", async () => {
  const { pair, publicKey } = await makeBrowserKey();
  const challenge = await createDeviceChallenge();
  const signature = await sign(pair.privateKey, "login", challenge);
  const imported = await importDevicePublicKey(publicKey);
  assert.equal(await verifyDeviceSignature(imported, "login", challenge, signature), true);
});

test("a registration signature can't be used to sign in", async () => {
  const { pair, publicKey } = await makeBrowserKey();
  const challenge = await createDeviceChallenge();
  const signature = await sign(pair.privateKey, "register", challenge);
  const imported = await importDevicePublicKey(publicKey);
  assert.equal(await verifyDeviceSignature(imported, "login", challenge, signature), false);
});

test("another device's key doesn't verify", async () => {
  const a = await makeBrowserKey();
  const b = await makeBrowserKey();
  const challenge = await createDeviceChallenge();
  const signature = await sign(a.pair.privateKey, "login", challenge);
  const imported = await importDevicePublicKey(b.publicKey);
  assert.equal(await verifyDeviceSignature(imported, "login", challenge, signature), false);
  assert.equal(await verifyDeviceSignature(imported, "login", challenge, "not-a-signature"), false);
});

test("the private key can't be exported", async () => {
  const { pair } = await makeBrowserKey();
  await assert.rejects(crypto.subtle.exportKey("pkcs8", pair.privateKey));
  await assert.rejects(crypto.subtle.exportKey("jwk", pair.privateKey));
});

test("the key id the server computes matches the browser's", async () => {
  const { publicKey, keyId } = await makeBrowserKey();
  const imported = await importDevicePublicKey(publicKey);
  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", imported));
  assert.equal(await sha256Hex(spki), keyId);
});
