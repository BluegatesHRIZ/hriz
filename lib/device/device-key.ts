/**
 * This browser's device key. Browser only.
 *
 * The private key is created non-extractable: the browser will sign with it but
 * never hands out its bytes, not even through DevTools, so the registration
 * can't be copied to another computer. Clearing this site's data deletes it,
 * and the device then has to be registered again.
 */

import {
  bytesToBase64Url,
  deviceSignMessage,
  sha256Hex,
  type DeviceSignPurpose,
} from "@/lib/auth/device-crypto";

const DB_NAME = "hriz-device";
const STORE = "keys";
const RECORD = "device";

export interface DeviceKey {
  keyId: string;
  publicKey: string;
  privateKey: CryptoKey;
}

export class DeviceKeyUnsupportedError extends Error {
  constructor() {
    super(
      "This browser can't keep a device key. Use an up-to-date Chrome, Edge, Firefox or Safari, outside private browsing.",
    );
    this.name = "DeviceKeyUnsupportedError";
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined" || !crypto?.subtle) {
      reject(new DeviceKeyUnsupportedError());
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new DeviceKeyUnsupportedError());
  });
}

function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = action(tx.objectStore(STORE));
        tx.oncomplete = () => {
          db.close();
          resolve(request.result as T);
        };
        tx.onerror = tx.onabort = () => {
          db.close();
          reject(tx.error ?? new DeviceKeyUnsupportedError());
        };
      }),
  );
}

/** The key this browser registered with, or null if it never registered (or its data was cleared). */
export async function loadDeviceKey(): Promise<DeviceKey | null> {
  try {
    const stored = await run<DeviceKey | undefined>("readonly", (s) => s.get(RECORD));
    return stored?.privateKey && stored.keyId ? stored : null;
  } catch {
    return null;
  }
}

/** Makes a new key for this browser, replacing any old one. */
export async function createDeviceKey(): Promise<DeviceKey> {
  if (typeof indexedDB === "undefined" || !crypto?.subtle) throw new DeviceKeyUnsupportedError();

  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    false, // private key can never be exported
    ["sign", "verify"],
  );
  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey));
  const key: DeviceKey = {
    keyId: await sha256Hex(spki),
    publicKey: bytesToBase64Url(spki),
    privateKey: pair.privateKey,
  };
  await run("readwrite", (s) => s.put(key, RECORD));
  return key;
}

export async function signWithDeviceKey(
  key: DeviceKey,
  purpose: DeviceSignPurpose,
  challenge: string,
): Promise<string> {
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key.privateKey,
    new TextEncoder().encode(deviceSignMessage(purpose, challenge)),
  );
  return bytesToBase64Url(new Uint8Array(signature));
}
