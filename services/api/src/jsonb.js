export function jsonbParam(value, fallback = null) {
  return JSON.stringify(value == null ? fallback : value);
}
