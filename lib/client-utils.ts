// crypto.randomUUID only exists in secure contexts (HTTPS or localhost); the store is also opened over
// plain HTTP on the LAN, where getRandomValues is still available.
export function uuid() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// navigator.clipboard has the same secure-context restriction; fall back to a hidden textarea.
export async function copyText(text: string) {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* fall through to the legacy path */ }
  const area = document.createElement("textarea");
  area.value = text; area.setAttribute("readonly", ""); area.style.position = "fixed"; area.style.opacity = "0";
  document.body.appendChild(area); area.select();
  try { return document.execCommand("copy"); } catch { return false; } finally { area.remove(); }
}

// One idempotency key per distinct checkout payload: retrying the same cart reuses it, changing anything gets a new one.
export function checkoutKey(payload: unknown) {
  const fingerprint = JSON.stringify(payload);
  try {
    const stored = JSON.parse(sessionStorage.getItem("ridekit-checkout-key") || "null") as { key: string; fingerprint: string } | null;
    if (stored?.fingerprint === fingerprint) return stored.key;
    const key = uuid();
    sessionStorage.setItem("ridekit-checkout-key", JSON.stringify({ key, fingerprint }));
    return key;
  } catch { return uuid(); }
}
