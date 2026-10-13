// Dates typed in the admin (datetime-local inputs) and Asaas expirations are Brasília wall-clock
// times without an offset. Brazil has had no daylight saving since 2019, so a fixed offset is exact.
export const STORE_UTC_OFFSET = "-03:00";

// SQLite expression for "now" in store wall-clock time; compare it with datetime(column).
export const STORE_NOW_SQL = "datetime('now','-3 hours')";

// Parses an admin/Asaas wall-clock value; strings that already carry an offset or "Z" are kept as is.
export function parseStoreDate(value: string) {
  const normalized = value.trim().replace(" ", "T");
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  const withTime = /T\d{2}:\d{2}/.test(normalized) ? normalized : `${normalized}T00:00:00`;
  return new Date(hasZone ? withTime : `${withTime}${STORE_UTC_OFFSET}`);
}
