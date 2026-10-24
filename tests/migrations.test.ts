import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { applyMigrations } from "../lib/db.ts";
import { testDb } from "./helpers/db.ts";

test("migrações numeradas rodam uma vez, em ordem, e desfazem a que falhar",()=>{
  const db=testDb(),dir=fs.mkdtempSync(path.join(os.tmpdir(),"ridekit-migrations-"));
  fs.writeFileSync(path.join(dir,"910-segunda.sql"),"INSERT INTO probe(step) VALUES('segunda');");
  fs.writeFileSync(path.join(dir,"902-primeira.sql"),"CREATE TABLE probe(step TEXT); INSERT INTO probe(step) VALUES('primeira');");
  applyMigrations(db,dir);
  applyMigrations(db,dir);
  assert.deepEqual((db.prepare("SELECT step FROM probe ORDER BY rowid").all() as {step:string}[]).map(item=>item.step),["primeira","segunda"]);
  fs.writeFileSync(path.join(dir,"911-quebrada.sql"),"INSERT INTO probe(step) VALUES('parcial'); INSERT INTO tabela_inexistente VALUES(1);");
  assert.throws(()=>applyMigrations(db,dir),/911-quebrada/);
  assert.equal((db.prepare("SELECT COUNT(*) AS count FROM probe WHERE step='parcial'").get() as {count:number}).count,0);
  assert.equal(db.prepare("SELECT version FROM schema_migrations WHERE version=911").get(),undefined);
});
