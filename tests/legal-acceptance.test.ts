import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { assertLegalAcceptance,recordLegalAcceptance,recordOrderLegalAcceptance } from "../lib/legal-acceptance.ts";
import { LEGAL_VERSION } from "../lib/legal-documents.ts";

test("exige aceite explícito da versão vigente",()=>{
  assert.throws(()=>assertLegalAcceptance({legal_version:LEGAL_VERSION,accept_terms:false,acknowledge_privacy:true}),/Termos/);
  assert.throws(()=>assertLegalAcceptance({legal_version:"2020-01-01",accept_terms:true,acknowledge_privacy:true}),/Termos/);
  assert.doesNotThrow(()=>assertLegalAcceptance({legal_version:LEGAL_VERSION,accept_terms:true,acknowledge_privacy:true}));
});

test("registra documentos e contexto sem duplicar reenvios",()=>{
  const db=new DatabaseSync(":memory:");
  db.exec("CREATE TABLE legal_acceptances(customer_id INTEGER,document_type TEXT,version TEXT,context TEXT,UNIQUE(customer_id,document_type,version,context))");
  db.exec("CREATE TABLE order_legal_acceptances(order_id INTEGER PRIMARY KEY,customer_id INTEGER,terms_version TEXT,privacy_version TEXT)");
  recordLegalAcceptance(db,42,"registration");
  recordLegalAcceptance(db,42,"registration");
  recordLegalAcceptance(db,42,"checkout");
  const rows=db.prepare("SELECT document_type,version,context FROM legal_acceptances ORDER BY context,document_type").all() as {document_type:string;version:string;context:string}[];
  assert.equal(rows.length,4);
  assert.ok(rows.every(row=>row.version===LEGAL_VERSION));
  recordOrderLegalAcceptance(db,100,42);
  recordOrderLegalAcceptance(db,101,42);
  assert.equal((db.prepare("SELECT COUNT(*) AS total FROM order_legal_acceptances").get() as {total:number}).total,2);
  db.close();
});
