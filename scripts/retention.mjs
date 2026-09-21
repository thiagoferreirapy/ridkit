import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import path from "node:path";

const databasePath=process.env.DATABASE_PATH||path.join(process.cwd(),"data","ridekit.sqlite");
const apply=process.argv.includes("--apply");
if(!existsSync(databasePath)){console.error(`Banco não encontrado: ${databasePath}`);process.exit(1);}

const db=new DatabaseSync(databasePath,{timeout:5000});
db.exec("PRAGMA foreign_keys=ON");
const rules=[
  {name:"password_reset_tokens",days:30,where:"(used_at IS NOT NULL OR datetime(expires_at)<datetime('now'))",date:"expires_at"},
  {name:"email_verification_tokens",days:30,where:"(used_at IS NOT NULL OR datetime(expires_at)<datetime('now'))",date:"expires_at"},
  {name:"refresh_tokens",days:30,where:"(revoked_at IS NOT NULL OR datetime(expires_at)<datetime('now'))",date:"expires_at"},
  {name:"carts",days:30,where:"customer_id IS NULL",date:"updated_at"},
  {name:"search_history",days:90,where:"1=1",date:"searched_at"},
];

try{
  db.exec("BEGIN IMMEDIATE");
  const summary={mode:apply?"applied":"preview",at:new Date().toISOString(),counts:{}};
  for(const rule of rules){
    const predicate=`${rule.where} AND datetime(${rule.date})<datetime('now', ?)`;
    const cutoff=`-${rule.days} days`;
    const count=db.prepare(`SELECT COUNT(*) AS total FROM ${rule.name} WHERE ${predicate}`).get(cutoff).total;
    summary.counts[rule.name]=count;
    if(apply&&count)db.prepare(`DELETE FROM ${rule.name} WHERE ${predicate}`).run(cutoff);
  }
  if(apply){
    db.exec("CREATE TABLE IF NOT EXISTS retention_runs (id INTEGER PRIMARY KEY AUTOINCREMENT,executed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,summary_json TEXT NOT NULL) STRICT");
    db.prepare("INSERT INTO retention_runs(summary_json) VALUES(?)").run(JSON.stringify(summary));
    db.exec("COMMIT");
  }else db.exec("ROLLBACK");
  console.log(JSON.stringify(summary,null,2));
}catch(error){if(db.isTransaction)db.exec("ROLLBACK");console.error(error);process.exitCode=1;}finally{db.close();}
