import { randomBytes } from "node:crypto";
const ID_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-";
export function createRenderId() {
    return createId(10);
}
export function createValidationId() {
    return `v-${createId(8)}`;
}
function createId(length) {
    return Array.from(randomBytes(length), (byte) => ID_ALPHABET[byte & 63]).join("");
}
