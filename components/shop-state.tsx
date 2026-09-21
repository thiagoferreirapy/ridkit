"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { fetchWithRefresh,useAuth } from "@/components/auth-state";

export type CartItem={id:number;quantity:number;variant_id:number;size:string;color:string;stock:number;product_id:number;name:string;slug:string;price_cents:number;brand:string;image_url?:string;total_cents:number};
export type CartSummary={items:number;subtotal_cents:number;shipping_cents:number;coupon_discount_cents?:number;total_cents:number};
export type CartCoupon={id:number;code:string;description:string|null;discount_type:"percent"|"fixed"|"shipping";discount_value:number;min_order_cents:number;eligible_subtotal_cents:number;scope_type:"all"|"category"|"product";scope_value:string|null};
export type CartData={session_id:string;items:CartItem[];summary:CartSummary;coupon_code?:string|null;coupon?:CartCoupon|null;coupon_options?:CartCoupon[];coupon_manual?:boolean};
export type FavoriteItem={id:number;slug:string;name:string;price_cents:number;compare_at_cents?:number;featured:number;brand:string;category:string;image_url?:string;photographer?:string;sizes_csv?:string};
export type PublicStoreSettings={store_name:string;purchase_mode:"site"|"whatsapp";whatsapp_number:string;whatsapp_message_intro:string;free_shipping_threshold_cents:number;standard_shipping_cents:number;express_shipping_cents:number;pix_discount_percent:number;max_installments:number;topbar_message:string};

type ShopState={
  sessionId:string; cart:CartData; favorites:FavoriteItem[]; settings:PublicStoreSettings; loading:boolean; busy:boolean; error:string;
  addToCart:(variantId:number,quantity?:number)=>Promise<boolean>;
  updateCartItem:(itemId:number,quantity:number)=>Promise<void>;
  removeCartItem:(itemId:number)=>Promise<void>;
  clearCart:()=>Promise<void>;
  applyCoupon:(code:string,selectManual?:boolean)=>Promise<{applied:boolean}>;
  removeCoupon:()=>Promise<void>;
  toggleFavorite:(productId:number)=>Promise<void>;
  isFavorite:(productId?:number)=>boolean;
};

const emptyCart:CartData={session_id:"",items:[],summary:{items:0,subtotal_cents:0,shipping_cents:0,total_cents:0}};
const defaultSettings:PublicStoreSettings={store_name:"Ridekit",purchase_mode:"site",whatsapp_number:"",whatsapp_message_intro:"",free_shipping_threshold_cents:29900,standard_shipping_cents:1990,express_shipping_cents:2990,pix_discount_percent:5,max_installments:10,topbar_message:"Frete grátis acima de R$ 299 · 10x sem juros · 5% no Pix"};
const ShopContext=createContext<ShopState|null>(null);

async function jsonRequest(url:string,init?:RequestInit){const response=await fetchWithRefresh(url,init);const payload=await response.json();if(!response.ok)throw new Error(payload.error||"Não foi possível concluir a ação");return payload.data;}
function createSessionId(){const uuid=typeof crypto!=="undefined"&&typeof crypto.randomUUID==="function"?crypto.randomUUID():`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,12)}`;return `ridekit-${uuid}`;}

export function ShopProvider({children}:{children:React.ReactNode}) {
  const {user,loading:authLoading}=useAuth();
  const [sessionId,setSessionId]=useState(""); const [cart,setCart]=useState<CartData>(emptyCart); const [favorites,setFavorites]=useState<FavoriteItem[]>([]);const [settings,setSettings]=useState(defaultSettings);
  const [loading,setLoading]=useState(true); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  useEffect(()=>{let id=localStorage.getItem("ridekit-session-id");if(!id){id=createSessionId();localStorage.setItem("ridekit-session-id",id);}setSessionId(id);Promise.all([jsonRequest(`/api/cart?session_id=${encodeURIComponent(id)}`),jsonRequest(`/api/favorites?session_id=${encodeURIComponent(id)}`),jsonRequest("/api/store-settings")]).then(([cartData,favoriteData,storeSettings])=>{setCart(cartData);setFavorites(favoriteData.items);setSettings(storeSettings);}).catch(reason=>setError(reason.message)).finally(()=>setLoading(false));},[]);
  useEffect(()=>{if(!sessionId||authLoading)return;let active=true;jsonRequest(`/api/cart?session_id=${encodeURIComponent(sessionId)}`).then(value=>{if(active)setCart(value);}).catch(reason=>{if(active)setError(reason.message);});return()=>{active=false;};},[sessionId,user?.id,authLoading]);
  const mutate=async<T,>(action:()=>Promise<T>)=>{setBusy(true);setError("");try{return await action();}catch(reason){setError(reason instanceof Error?reason.message:"Erro inesperado");throw reason;}finally{setBusy(false);}};
  const addToCart=async(variantId:number,quantity=1)=>{if(!sessionId)return false;try{await mutate(async()=>setCart(await jsonRequest("/api/cart",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:sessionId,variant_id:variantId,quantity})})));return true;}catch{return false;}};
  const updateCartItem=async(itemId:number,quantity:number)=>{if(!sessionId)return;await mutate(async()=>setCart(await jsonRequest("/api/cart",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:sessionId,item_id:itemId,quantity})})));};
  const removeCartItem=async(itemId:number)=>{if(!sessionId)return;await mutate(async()=>setCart(await jsonRequest("/api/cart",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:sessionId,item_id:itemId})})));};
  const clearCart=async()=>{if(!sessionId)return;await mutate(async()=>{let latest=cart;for(const item of cart.items)latest=await jsonRequest("/api/cart",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:sessionId,item_id:item.id})});if(user)await jsonRequest("/api/cart/coupon",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:sessionId})});setCart({...latest,coupon:null,coupon_code:null});});};
  const applyCoupon=async(code:string,selectManual=false)=>{if(!sessionId)throw new Error("Aguarde o carregamento do carrinho");return mutate(async()=>{const result=await jsonRequest("/api/cart/coupon",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:sessionId,code,select:selectManual})});setCart(await jsonRequest(`/api/cart?session_id=${encodeURIComponent(sessionId)}`));return {applied:Boolean(result.applied)};});};
  const removeCoupon=async()=>{if(!sessionId)return;await mutate(async()=>{await jsonRequest("/api/cart/coupon",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:sessionId})});setCart(await jsonRequest(`/api/cart?session_id=${encodeURIComponent(sessionId)}`));});};
  const isFavorite=(productId?:number)=>Boolean(productId&&favorites.some(item=>item.id===productId));
  const toggleFavorite=async(productId:number)=>{if(!sessionId)return;const method=isFavorite(productId)?"DELETE":"POST";await mutate(async()=>{const data=await jsonRequest("/api/favorites",{method,headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:sessionId,product_id:productId})});setFavorites(data.items);});};
  return <ShopContext.Provider value={{sessionId,cart,favorites,settings,loading,busy,error,addToCart,updateCartItem,removeCartItem,clearCart,applyCoupon,removeCoupon,toggleFavorite,isFavorite}}>{children}</ShopContext.Provider>;
}

export function useShop(){const value=useContext(ShopContext);if(!value)throw new Error("useShop deve ser usado dentro de ShopProvider");return value;}
