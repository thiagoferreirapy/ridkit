import { ZodError } from "zod";

export function ok(data: unknown, init?: ResponseInit) {
  return Response.json({ data }, { status: 200, ...init });
}

export function created(data: unknown) {
  return Response.json({ data }, { status: 201 });
}

export function apiError(error: unknown) {
  if (error instanceof ZodError) return Response.json({ error: "Dados inválidos", details: error.flatten() }, { status: 422 });
  const message = error instanceof Error ? error.message : "Erro inesperado";
  if (message === "NOT_FOUND") return Response.json({ error: "Recurso não encontrado" }, { status: 404 });
  if (message === "UNAUTHORIZED") return Response.json({ error: "Sessão expirada" }, { status: 401 });
  if (message === "FORBIDDEN") return Response.json({ error: "Acesso administrativo necessário" }, { status: 403 });
  if (message === "TOO_MANY_REQUESTS") return Response.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  if (message.startsWith("CONFLICT:")) return Response.json({ error: message.slice(9) }, { status: 409 });
  if (message.startsWith("BAD_REQUEST:")) return Response.json({ error: message.slice(12) }, { status: 400 });
  if (message.startsWith("VALIDATION:")) return Response.json({ error: message.slice(11) }, { status: 422 });
  console.error("API error", error);
  return Response.json({ error: "Erro interno da API" }, { status: 500 });
}

export function pagination(searchParams: URLSearchParams) {
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 12));
  return { page, limit, offset: (page - 1) * limit };
}

export function slugify(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function parseId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new Error("BAD_REQUEST:ID inválido");
  return id;
}
