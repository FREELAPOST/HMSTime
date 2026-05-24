import { pbkdf2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { AppError } from "./errors.js";

const pbkdf2Async = promisify(pbkdf2);
const ITERATIONS = 310000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";
const HASH_PREFIX = "pbkdf2_sha256";

export function assertPinFormat(pin: string) {
  if (!/^\d{4}$/.test(pin)) {
    throw new AppError("PIN deve conter exatamente 4 dígitos.", 422);
  }
}

export async function hashPin(pin: string) {
  assertPinFormat(pin);
  const salt = randomBytes(16);
  const hash = await pbkdf2Async(pin, salt, ITERATIONS, KEY_LENGTH, DIGEST);
  return `${HASH_PREFIX}$${ITERATIONS}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function comparePin(pin: string, hash: string) {
  assertPinFormat(pin);

  const [prefix, iterationsRaw, saltRaw, hashRaw] = hash.split("$");
  if (prefix !== HASH_PREFIX || !iterationsRaw || !saltRaw || !hashRaw) {
    return false;
  }

  const iterations = Number(iterationsRaw);
  if (!Number.isInteger(iterations) || iterations < 100000) {
    return false;
  }

  const salt = Buffer.from(saltRaw, "base64");
  const expected = Buffer.from(hashRaw, "base64");
  const actual = await pbkdf2Async(pin, salt, iterations, expected.length, DIGEST);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
