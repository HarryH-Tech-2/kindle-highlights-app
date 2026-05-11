// Math.random-based RFC 4122 v4 UUID. Sufficient for client-generated IDs of
// user-scoped data (collisions are scoped to one user's set of rows, and the
// 122-bit random space makes accidental collisions vanishingly unlikely). We
// avoid `crypto.randomUUID()` / `react-native-get-random-values` so this stays
// usable in plain Node test environments without native shims.
export function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
