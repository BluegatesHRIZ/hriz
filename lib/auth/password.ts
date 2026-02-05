import crypto from "crypto"

// Fixed salt value from C# implementation
const BLUEGATESSALT = Buffer.from("bluegeatessalting", "utf-8")

/**
 * Encrypts a password using HMACSHA512 with the fixed bluegatessalt
 * Ported from C# EncryptPassword method
 */
export function encryptPassword(password: string): Buffer {
  const hmac = crypto.createHmac("sha512", BLUEGATESSALT)
  hmac.update(password, "utf-8")
  return hmac.digest()
}

/**
 * Verifies a password hash using HMACSHA512
 * Ported from C# VerifyPasswordHash method
 */
export function verifyPasswordHash(
  password: string,
  passwordHash: Buffer,
  passwordSalt: Buffer
): boolean {
  const hmac = crypto.createHmac("sha512", passwordSalt)
  hmac.update(password, "utf-8")
  const computedHash = hmac.digest()
  
  return Buffer.compare(computedHash, passwordHash) === 0
}
