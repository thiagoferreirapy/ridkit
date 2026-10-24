type AsaasCustomer={id:string};
export type AsaasPayment={id:string;status:string;value?:number;paymentDate?:string;confirmedDate?:string;deleted?:boolean};
export type AsaasPixQrCode={encodedImage:string;payload:string;expirationDate:string};

const apiUrl=()=>process.env.ASAAS_API_URL||"https://api-sandbox.asaas.com/v3";

async function asaasRequest<T>(path:string,init?:RequestInit):Promise<T>{
  const apiKey=process.env.ASAAS_API_KEY;
  if(!apiKey)throw new Error("BAD_REQUEST:Pagamento Pix ainda não foi configurado");
  const response=await fetch(`${apiUrl()}${path}`,{...init,headers:{accept:"application/json","content-type":"application/json",access_token:apiKey,...init?.headers},cache:"no-store"});
  const body=await response.json().catch(()=>null) as {errors?:{description?:string}[]}|null;
  if(!response.ok){
    const detail=body?.errors?.map(item=>item.description).filter(Boolean).join(" ")||"O Asaas não aceitou a operação";
    throw Object.assign(new Error(`BAD_REQUEST:${detail}`),{status:response.status});
  }
  return body as T;
}

export async function createAsaasCustomer(value:{name:string;cpf:string;email:string;phone?:string|null;externalReference:string;address:{zip_code:string;street:string;number:string;complement?:string;district:string;city:string;state:string}}){
  return asaasRequest<AsaasCustomer>("/customers",{method:"POST",body:JSON.stringify({name:value.name,cpfCnpj:value.cpf.replace(/\D/g,""),email:value.email,mobilePhone:value.phone?.replace(/\D/g,""),externalReference:value.externalReference,postalCode:value.address.zip_code.replace(/\D/g,""),address:value.address.street,addressNumber:value.address.number,complement:value.address.complement||undefined,province:value.address.district})});
}

export async function createAsaasPixPayment(value:{customer:string;orderId:number;orderNumber:string;totalCents:number}){
  // Due date is a calendar day in Brasília; deriving it from UTC skips a day after 21:00 local time.
  const due=new Date(Date.now()-3*60*60_000+24*60*60_000).toISOString().slice(0,10);
  return asaasRequest<AsaasPayment>("/payments",{method:"POST",body:JSON.stringify({customer:value.customer,billingType:"PIX",value:Number((value.totalCents/100).toFixed(2)),dueDate:due,description:`Pedido Ridekit #${value.orderNumber}`,externalReference:`ridekit-order-${value.orderId}`})});
}

export async function getAsaasPixQrCode(paymentId:string){return asaasRequest<AsaasPixQrCode>(`/payments/${encodeURIComponent(paymentId)}/pixQrCode`);}
export async function getAsaasPayment(paymentId:string){return asaasRequest<AsaasPayment>(`/payments/${encodeURIComponent(paymentId)}`);}

// Deletes a pending charge so its Pix QR stops being payable. "paid" means Asaas already received it: the webhook settles the order.
export async function cancelAsaasPayment(paymentId:string):Promise<"deleted"|"paid">{
  try{await asaasRequest(`/payments/${encodeURIComponent(paymentId)}`,{method:"DELETE"});return "deleted";}
  catch(error){
    if((error as {status?:number}).status===404)return "deleted";
    const payment=await getAsaasPayment(paymentId).catch(()=>null);
    if(payment?.deleted)return "deleted";
    if(payment&&["RECEIVED","CONFIRMED","RECEIVED_IN_CASH"].includes(payment.status))return "paid";
    throw error;
  }
}
