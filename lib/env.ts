const isProduction = () => process.env.NODE_ENV === "production";

// Development fallbacks are public strings; in production a missing secret must stop the request.
export function requireSecret(name: string, developmentFallback: string) {
  const value = process.env[name];
  if (value) return value;
  if (isProduction()) throw new Error(`${name} não configurado`);
  return developmentFallback;
}

// Links sent by e-mail must never be built from the Host header in production.
export function appUrl(request?: Request) {
  const configured = process.env.APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  if (isProduction()) throw new Error("APP_URL não configurado");
  return request ? new URL(request.url).origin : "http://localhost:3000";
}
