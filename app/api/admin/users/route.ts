import { z } from "zod";
import { apiError, created, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email(),
  password: z.string().min(8).max(128),
  role: z.enum(["admin", "manager", "support"]),
});

const updateSchema = z.object({
  id: z.coerce.number().int().positive(),
  role: z.enum(["admin", "manager", "support"]).optional(),
  active: z.coerce.number().int().min(0).max(1).optional(),
});

export async function GET() {
  try {
    await requireAdmin(["admin"]);
    return ok(getDb().prepare("SELECT id,name,email,role,active,last_login_at,created_at FROM admin_users ORDER BY name").all());
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(["admin"]);
    const value = createSchema.parse(await request.json());
    const result = getDb().prepare("INSERT INTO admin_users(name,email,password_hash,role) VALUES(?,?,?,?)").run(value.name,value.email.toLowerCase(),hashPassword(value.password),value.role);
    audit(admin.id,"create","admin_users",Number(result.lastInsertRowid),{role:value.role});
    return created({id:Number(result.lastInsertRowid)});
  } catch (error) {
    if(error instanceof Error&&/UNIQUE/.test(error.message))return apiError(new Error("CONFLICT:E-mail já cadastrado"));
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin(["admin"]);
    const value = updateSchema.parse(await request.json());
    if(value.id===admin.id&&value.active===0)throw new Error("BAD_REQUEST:Você não pode desativar a própria conta");
    const entries = Object.entries(value).filter(([key])=>key!=="id");
    if(!entries.length)throw new Error("BAD_REQUEST:Nenhuma alteração informada");
    getDb().prepare(`UPDATE admin_users SET ${entries.map(([key])=>`${key}=?`).join(",")} WHERE id=?`).run(...entries.map(([,item])=>item),value.id);
    audit(admin.id,"update","admin_users",value.id,Object.fromEntries(entries));
    return ok({updated:true});
  } catch (error) { return apiError(error); }
}
