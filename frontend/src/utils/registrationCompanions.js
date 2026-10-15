// Keep the editable string/blank intact; validate only when submitting.
export function isValidCompanionCount(value) {
  const text = String(value ?? '').trim();
  return text === '' || (/^\d+$/.test(text) && Number.isSafeInteger(Number(text)));
}
