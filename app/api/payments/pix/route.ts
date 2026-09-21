import { getDb } from "@/lib/db";
import { apiError, created, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createAsaasCustomer,createAsaasPixPayment,getAsaasPixQrCode } from "@/lib/asaas";

export const runtime="nodejs";

type Address={zip_code:string;street:string;number:string;complement?:string;district:string;city:string;state:string};
type PaymentOrder={id:number;customer_id:number;order_number:string;payment_method:string;payment_status:string;total_cents:number;shipping_address_json:string;checkout_contact_json:string|null;provider_payment_id:string|null;pix_qr_code:string|null;pix_qr_image:string|null;pix_expires_at:string|null};

function paymentData(order:PaymentOrder){return {order_id:order.id,order_number:order.order_number,payment_status:order.payment_status,qr_code:order.pix_qr_code,qr_image:order.pix_qr_image,expires_at:order.pix_expires_at};}

export async function GET(request:Request){
  try{const user=await requireUser();const id=Number(new URL(request.url).searchParams.get("order_id"));if(!Number.isInteger(id)||id<1)throw new Error("BAD_REQUEST:Pedido inválido");const order=getDb().prepare("SELECT * FROM orders WHERE id=? AND customer_id=?").get(id,user.id) as PaymentOrder|undefined;if(!order)throw new Error("NOT_FOUND");return ok(paymentData(order));}catch(error){return apiError(error);}
}

export async function POST(request:Request){
  try{
    const user=await requireUser(),db=getDb(),body=await request.json(),orderId=Number(body.order_id);
    if(!Number.isInteger(orderId)||orderId<1)throw new Error("BAD_REQUEST:Pedido inválido");
    let order=db.prepare("SELECT * FROM orders WHERE id=? AND customer_id=?").get(orderId,user.id) as PaymentOrder|undefined;
    if(!order)throw new Error("NOT_FOUND");if(order.payment_method!=="pix")throw new Error("BAD_REQUEST:Este pedido não usa Pix");
    if(order.provider_payment_id&&order.pix_qr_code)return ok(paymentData(order));
    const customer=db.prepare("SELECT id,name,email,cpf,phone,asaas_customer_id FROM customers WHERE id=?").get(user.id) as {id:number;name:string;email:string;cpf:string|null;phone:string|null;asaas_customer_id:string|null}|undefined;
    if(!customer)throw new Error("NOT_FOUND");
    const contact=order.checkout_contact_json?JSON.parse(order.checkout_contact_json) as {email:string;cpf:string;phone:string}:{email:customer.email,cpf:customer.cpf||"",phone:customer.phone||""};
    if(!/^\d{11}$/.test(contact.cpf.replace(/\D/g,"")))throw new Error("BAD_REQUEST:Informe um CPF válido antes de pagar");
    const address=JSON.parse(order.shipping_address_json) as Address;
    let asaasCustomerId=customer.asaas_customer_id;
    if(!asaasCustomerId){const remote=await createAsaasCustomer({name:customer.name,cpf:contact.cpf,email:contact.email,phone:contact.phone,externalReference:`ridekit-customer-${customer.id}`,address});asaasCustomerId=remote.id;db.prepare("UPDATE customers SET asaas_customer_id=? WHERE id=? AND asaas_customer_id IS NULL").run(asaasCustomerId,customer.id);}
    const payment=await createAsaasPixPayment({customer:asaasCustomerId,orderId:order.id,orderNumber:order.order_number,totalCents:order.total_cents});
    const qr=await getAsaasPixQrCode(payment.id);
    db.prepare("UPDATE orders SET payment_provider='asaas',provider_payment_id=?,pix_qr_code=?,pix_qr_image=?,pix_expires_at=?,payment_updated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND provider_payment_id IS NULL").run(payment.id,qr.payload,qr.encodedImage,qr.expirationDate,order.id);
    order=db.prepare("SELECT * FROM orders WHERE id=?").get(order.id) as PaymentOrder;
    return created(paymentData(order));
  }catch(error){return apiError(error);}
}
