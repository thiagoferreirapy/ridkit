import { getDb } from "@/lib/db";

export function audit(adminId:number,action:string,resource:string,resourceId?:string|number,details?:unknown){getDb().prepare("INSERT INTO admin_audit_logs(admin_id,action,resource,resource_id,details) VALUES(?,?,?,?,?)").run(adminId,action,resource,resourceId===undefined?null:String(resourceId),details===undefined?null:JSON.stringify(details));}
