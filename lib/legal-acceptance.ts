import { type DatabaseSync } from "node:sqlite";
import { LEGAL_VERSION } from "./legal-documents.ts";

export function assertLegalAcceptance(value:{legal_version?:string;accept_terms?:boolean;acknowledge_privacy?:boolean}) {
  if(value.legal_version!==LEGAL_VERSION||value.accept_terms!==true||value.acknowledge_privacy!==true)throw new Error("VALIDATION:Leia e aceite os Termos de Uso e confirme ciência da Política de Privacidade atualizada.");
}

export function recordLegalAcceptance(db:DatabaseSync,customerId:number,context:"registration"|"checkout") {
  const insert=db.prepare("INSERT OR IGNORE INTO legal_acceptances(customer_id,document_type,version,context) VALUES(?,?,?,?)");
  insert.run(customerId,"terms",LEGAL_VERSION,context);
  insert.run(customerId,"privacy",LEGAL_VERSION,context);
}

export function recordOrderLegalAcceptance(db:DatabaseSync,orderId:number,customerId:number) {
  db.prepare("INSERT INTO order_legal_acceptances(order_id,customer_id,terms_version,privacy_version) VALUES(?,?,?,?)").run(orderId,customerId,LEGAL_VERSION,LEGAL_VERSION);
}
