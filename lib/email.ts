import { getDb } from "@/lib/db";

type Email={to:string;subject:string;html:string};
export type BulkEmail=Email;

export async function sendEmail({to,subject,html}:Email){
  const apiKey=process.env.RESEND_API_KEY;
  const from=process.env.EMAIL_FROM||"Ridekit <onboarding@resend.dev>";
  if(!apiKey){
    getDb().prepare("INSERT INTO email_outbox(recipient,subject,status,error) VALUES(?,?,'preview',?)").run(to,subject,"RESEND_API_KEY não configurada");
    return {sent:false,preview:true};
  }
  const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({from,to:[to],subject,html})});
  const result=await response.json() as {id?:string;message?:string};
  getDb().prepare("INSERT INTO email_outbox(recipient,subject,status,provider_id,error) VALUES(?,?,?,?,?)").run(to,subject,response.ok?"sent":"failed",result.id||null,response.ok?null:result.message||"Falha no provedor");
  return response.ok?{sent:true,id:result.id}:{sent:false,error:result.message||"Falha no provedor"};
}

export async function sendBulkEmails(messages:BulkEmail[]){
  const apiKey=process.env.RESEND_API_KEY,from=process.env.EMAIL_FROM||"Ridekit <onboarding@resend.dev>",db=getDb();
  const results:{to:string;sent:boolean;preview?:boolean;id?:string;error?:string}[]=[];
  for(let index=0;index<messages.length;index+=100){
    const chunk=messages.slice(index,index+100);
    if(!apiKey){for(const message of chunk){db.prepare("INSERT INTO email_outbox(recipient,subject,status,error) VALUES(?,?,'preview',?)").run(message.to,message.subject,"RESEND_API_KEY não configurada");results.push({to:message.to,sent:false,preview:true});}continue;}
    try{
      const response=await fetch("https://api.resend.com/emails/batch",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify(chunk.map(message=>({from,to:[message.to],subject:message.subject,html:message.html})))}),body=await response.json() as {data?:{id:string}[];message?:string};
      chunk.forEach((message,position)=>{const id=body.data?.[position]?.id,error=response.ok?undefined:body.message||"Falha no provedor";db.prepare("INSERT INTO email_outbox(recipient,subject,status,provider_id,error) VALUES(?,?,?,?,?)").run(message.to,message.subject,response.ok?"sent":"failed",id||null,error||null);results.push({to:message.to,sent:response.ok,id,error});});
    }catch(error){const detail=error instanceof Error?error.message:"Falha de conexão";for(const message of chunk){db.prepare("INSERT INTO email_outbox(recipient,subject,status,error) VALUES(?,?,'failed',?)").run(message.to,message.subject,detail);results.push({to:message.to,sent:false,error:detail});}}
  }
  return results;
}
