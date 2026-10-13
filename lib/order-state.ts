import type { DatabaseSync } from "node:sqlite";

// Single owner of order status, payment status, stock and coupon usage. Every caller (checkout
// webhook, admin, reconciliation, reservation expiry) goes through here so the rules cannot drift.

export type OrderStatus="pending"|"paid"|"preparing"|"shipped"|"delivered"|"cancelled"|"refunded";
export type PaymentStatus="pending"|"approved"|"failed"|"refunded";
export type PaymentOutcome="approved"|"failed"|"expired"|"refunded";

type Holding="reserved"|"sold"|"none";
type OrderRow={id:number;status:OrderStatus;payment_status:PaymentStatus;coupon_id:number|null;total_cents:number};
type Item={variant_id:number;quantity:number};
type Context={adminId?:number|null;reason:string};

// Where the order's units live for each status.
const holdingFor=(status:OrderStatus):Holding=>status==="pending"?"reserved":status==="cancelled"||status==="refunded"?"none":"sold";
const holdsCoupon=(status:OrderStatus)=>status!=="cancelled"&&status!=="refunded";

// Manual changes from the admin panel. Cancelling a paid order is a refund, so it goes through "refunded".
export const ADMIN_TRANSITIONS:Record<OrderStatus,OrderStatus[]>={
  pending:["paid","cancelled"],
  paid:["preparing","shipped","refunded"],
  preparing:["shipped","refunded"],
  shipped:["delivered","refunded"],
  delivered:["refunded"],
  cancelled:[],
  refunded:[],
};

export class StockConflict extends Error{constructor(message:string){super(`CONFLICT:${message}`);}}

export function inTransaction<T>(db:DatabaseSync,run:()=>T):T{
  if(db.isTransaction)return run();
  db.exec("BEGIN IMMEDIATE");
  try{const result=run();db.exec("COMMIT");return result;}
  catch(error){if(db.isTransaction)db.exec("ROLLBACK");throw error;}
}

function loadOrder(db:DatabaseSync,orderId:number){
  return db.prepare("SELECT id,status,payment_status,coupon_id,total_cents FROM orders WHERE id=?").get(orderId) as OrderRow|undefined;
}

function orderItems(db:DatabaseSync,orderId:number){
  return db.prepare("SELECT variant_id,SUM(quantity) AS quantity FROM order_items WHERE order_id=? GROUP BY variant_id").all(orderId) as Item[];
}

function moveStock(db:DatabaseSync,orderId:number,from:OrderStatus,to:OrderStatus,context:Context){
  const source=holdingFor(from),target=holdingFor(to);
  if(source===target)return "";
  // Units already with the customer are not put back on the shelf automatically.
  if(source==="sold"&&target==="none"&&(from==="shipped"||from==="delivered"))return " Estoque não devolvido automaticamente: o pedido já tinha sido enviado; registre a devolução física no estoque.";
  const items=orderItems(db,orderId);
  const variant=db.prepare("SELECT stock,reserved_stock FROM product_variants WHERE id=?");
  // Check every item before touching any row so a conflict never leaves a partial update.
  for(const item of items){
    const state=variant.get(item.variant_id) as {stock:number;reserved_stock:number}|undefined;
    if(!state)throw new StockConflict("Variação do pedido não encontrada");
    const free=state.stock-state.reserved_stock;
    if(source==="reserved"&&target==="sold"&&state.stock<item.quantity)throw new StockConflict("Estoque insuficiente para confirmar o pedido");
    if(source==="none"&&free<item.quantity)throw new StockConflict("Estoque insuficiente para reabrir o pedido");
  }
  const plans:Record<string,{sql:string;type:string;sign:number;args:number}>={
    "reserved>sold":{sql:"stock=stock-?,reserved_stock=MAX(0,reserved_stock-?)",type:"sale",sign:-1,args:2},
    "reserved>none":{sql:"reserved_stock=MAX(0,reserved_stock-?)",type:"release",sign:-1,args:1},
    "none>reserved":{sql:"reserved_stock=reserved_stock+?",type:"reservation",sign:1,args:1},
    "none>sold":{sql:"stock=stock-?",type:"sale",sign:-1,args:1},
    "sold>none":{sql:"stock=stock+?",type:"return",sign:1,args:1},
    "sold>reserved":{sql:"stock=stock+?,reserved_stock=reserved_stock+?",type:"return",sign:1,args:2},
  },plan=plans[`${source}>${target}`];
  const update=db.prepare(`UPDATE product_variants SET ${plan.sql} WHERE id=?`);
  const movement=db.prepare("INSERT INTO inventory_movements(variant_id,order_id,admin_id,movement_type,quantity,stock_after,reserved_after,reason) VALUES(?,?,?,?,?,?,?,?)");
  for(const item of items){
    update.run(...Array(plan.args).fill(item.quantity),item.variant_id);
    const after=variant.get(item.variant_id) as {stock:number;reserved_stock:number};
    movement.run(item.variant_id,orderId,context.adminId??null,plan.type,plan.sign*item.quantity,after.stock,after.reserved_stock,context.reason);
  }
  return "";
}

function transition(db:DatabaseSync,order:OrderRow,to:OrderStatus,payment:PaymentStatus,event:{title:string;description?:string},context:Context){
  const note=moveStock(db,order.id,order.status,to,context);
  if(order.coupon_id&&holdsCoupon(order.status)!==holdsCoupon(to))db.prepare(holdsCoupon(to)?"UPDATE coupons SET used_count=used_count+1 WHERE id=?":"UPDATE coupons SET used_count=MAX(0,used_count-1) WHERE id=?").run(order.coupon_id);
  // The status guard turns any concurrent writer that slipped past the read into a visible conflict.
  // A successful transition resolves any earlier warning; the warning itself stays in order_events.
  const result=db.prepare("UPDATE orders SET status=?,payment_status=?,attention_reason=NULL,payment_updated_at=CASE WHEN payment_status<>? THEN CURRENT_TIMESTAMP ELSE payment_updated_at END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status=? AND payment_status=?").run(to,payment,payment,order.id,order.status,order.payment_status);
  if(!result.changes)throw new Error("CONFLICT:O pedido foi alterado ao mesmo tempo por outro processo. Atualize e tente novamente.");
  db.prepare("INSERT INTO order_events(order_id,status,title,description) VALUES(?,?,?,?)").run(order.id,to,event.title,`${event.description||""}${note}`.trim()||null);
  return {...order,status:to,payment_status:payment};
}

function flag(db:DatabaseSync,order:OrderRow,reason:string,payment:PaymentStatus=order.payment_status){
  db.prepare("UPDATE orders SET attention_reason=?,payment_status=?,payment_updated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(reason,payment,order.id);
  db.prepare("INSERT INTO order_events(order_id,status,title,description) VALUES(?,?,?,?)").run(order.id,order.status,"Pedido precisa de atenção",reason);
}

export function adminTransition(db:DatabaseSync,orderId:number,to:OrderStatus,options:{adminId:number;description?:string;trackingCode?:string}){
  return inTransaction(db,()=>{
    const order=loadOrder(db,orderId);
    if(!order)throw new Error("NOT_FOUND");
    if(options.trackingCode!==undefined)db.prepare("UPDATE orders SET tracking_code=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(options.trackingCode||null,orderId);
    if(to===order.status){
      if(options.trackingCode!==undefined||options.description)db.prepare("INSERT INTO order_events(order_id,status,title,description) VALUES(?,?,?,?)").run(orderId,to,"Pedido atualizado",options.description||null);
      return {order,changed:false};
    }
    if(!ADMIN_TRANSITIONS[order.status].includes(to))throw new Error(`CONFLICT:Não é possível mudar o pedido de "${order.status}" para "${to}".`);
    const payment:PaymentStatus=to==="paid"?"approved":to==="refunded"?"refunded":to==="cancelled"&&order.payment_status==="pending"?"failed":order.payment_status;
    return {order:transition(db,order,to,payment,{title:`Status atualizado: ${to}`,description:options.description},{adminId:options.adminId,reason:`Alteração manual do pedido para ${to}`}),changed:true};
  });
}

export function applyPaymentOutcome(db:DatabaseSync,orderId:number,outcome:PaymentOutcome,options:{source:"webhook"|"reconcile"|"expiry";paidValueCents?:number;adminId?:number|null}){
  return inTransaction(db,()=>{
    const order=loadOrder(db,orderId);
    if(!order)throw new Error("NOT_FOUND");
    const origin=options.source==="webhook"?"pelo Asaas":options.source==="reconcile"?"na reconciliação manual":"pela rotina de expiração";
    const context={adminId:options.adminId,reason:`Pagamento ${outcome} ${origin}`};
    if(outcome==="approved"){
      // Duplicates and late "received" events after a refund must not sell the stock again.
      if(order.payment_status==="approved"||order.payment_status==="refunded")return {applied:false,status:order.status};
      if(options.paidValueCents!==undefined&&options.paidValueCents!==order.total_cents){
        flag(db,order,`Valor pago (${(options.paidValueCents/100).toFixed(2)}) diferente do total do pedido (${(order.total_cents/100).toFixed(2)}). Pedido não confirmado automaticamente.`);
        return {applied:false,status:order.status,attention:true};
      }
      if(order.status!=="pending"&&order.status!=="cancelled")return {applied:false,status:order.status};
      const late=order.status==="cancelled";
      try{
        const event=late?{title:"Pagamento aprovado após expiração",description:"O pagamento chegou depois da reserva expirar; os itens ainda estavam disponíveis e foram vendidos."}:{title:"Pagamento Pix aprovado",description:`Pagamento confirmado ${origin}.`};
        return {applied:true,status:transition(db,order,"paid","approved",event,context).status};
      }catch(error){
        // Throwing here would make the provider retry forever; record the money and hand it to a human.
        if(!(error instanceof StockConflict))throw error;
        flag(db,order,late?"Pagamento recebido após o cancelamento e sem estoque para atender. Estorne o pagamento ao cliente.":"Pagamento recebido, mas o estoque registrado não cobre o pedido. Confira o estoque antes de enviar.","approved");
        return {applied:false,status:order.status,attention:true};
      }
    }
    if(outcome==="failed"||outcome==="expired"){
      if(order.status!=="pending"||order.payment_status!=="pending")return {applied:false,status:order.status};
      const event=outcome==="expired"?{title:"Reserva expirada",description:"Reserva liberada porque o pagamento não foi concluído a tempo."}:{title:"Pagamento Pix não concluído",description:"A cobrança Pix expirou ou foi removida."};
      return {applied:true,status:transition(db,order,"cancelled","failed",event,context).status};
    }
    if(order.payment_status!=="approved")return {applied:false,status:order.status};
    return {applied:true,status:transition(db,order,"refunded","refunded",{title:"Pagamento estornado",description:`Estorno informado ${origin}.`},context).status};
  });
}

export function expireReservations(db:DatabaseSync,adminId?:number|null){
  return inTransaction(db,()=>{
    // Selected inside the transaction; applyPaymentOutcome re-checks each order's status before acting.
    const due=db.prepare("SELECT id FROM orders WHERE status='pending' AND payment_status='pending' AND reservation_expires_at IS NOT NULL AND datetime(reservation_expires_at)<=CURRENT_TIMESTAMP").all() as {id:number}[];
    return due.filter(order=>applyPaymentOutcome(db,order.id,"expired",{source:"expiry",adminId}).applied).length;
  });
}

// SQLite UTC format, comparable with CURRENT_TIMESTAMP through datetime().
export const sqliteUtc=(date:Date)=>date.toISOString().slice(0,19).replace("T"," ");
