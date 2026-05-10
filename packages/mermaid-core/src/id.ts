import { randomBytes } from "node:crypto"

const ID_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-"

export function createRenderId(): string {
  return createId(10)
}

export function createValidationId(): string {
  return `v-${createId(8)}`
}

function createId(length: number): string {
  return Array.from(randomBytes(length), (byte) => ID_ALPHABET[byte & 63]).join("")
}
