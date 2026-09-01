"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type CartItem={id:number;quantity:number;variant_id:number;size:string;color:string;stock:number;product_id:number;name:string;slug:string;price_cents:number;brand:string;image_url?:string;total_cents:number};
export type CartSummary={items:number;subtotal_cents:number;shipping_cents:number;total_cents:number};
export type CartData={session_id:string;items:CartItem[];summary:CartSummary};
export type FavoriteItem={id:number;slug:string;name:string;price_cents:number;compare_at_cents?:number;featured:number;brand:string;category:string;image_url?:string;photographer?:string;sizes_csv?:string};

type ShopState={
  cart:CartData; favorites:FavoriteItem[]; loading:boolean; busy:boolean; error:string;
  addToCart:(variantId:number,quantity?:number)=>Promise<boolean>;
  updateCartItem:(itemId:number,quantity:number)=>Promise<void>;
  removeCartItem:(itemId:number)=>Promise<void>;
  toggleFavorite:(productId:number)=>Promise<void>;
  isFavorite:(productId?:number)=>boolean;
};

const emptyCart:CartData={session_id:"",items:[],summary:{items:0,subtotal_cents:0,shipping_cents:0,total_cents:0}};
const ShopContext=createContext<ShopState|null>(null);

async function jsonRequest(url:string,init?:RequestInit){const response=await fetch(url,init);const payload=await response.json();if(!response.ok)throw new Error(payload.error||"Não foi possível concluir a ação");return payload.data;}
function createSessionId(){const uuid=typeof crypto!=="undefined"&&typeof crypto.randomUUID==="function"?crypto.randomUUID():`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,12)}`;return `ridekit-${uuid}`;}

export function ShopProvider({children}:{children:React.ReactNode}) {
  const [sessionId,setSessionId]=useState(""); const [cart,setCart]=useState<CartData>(emptyCart); const [favorites,setFavorites]=useState<FavoriteItem[]>([]);
  const [loading,setLoading]=useState(true); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  useEffect(()=>{let id=localStorage.getItem("ridekit-session-id");if(!id){id=createSessionId();localStorage.setItem("ridekit-session-id",id);}setSessionId(id);Promise.all([jsonRequest(`/api/cart?session_id=${encodeURIComponent(id)}`),jsonRequest(`/api/favorites?session_id=${encodeURIComponent(id)}`)]).then(([cartData,favoriteData])=>{setCart(cartData);setFavorites(favoriteData.items);}).catch(reason=>setError(reason.message)).finally(()=>setLoading(false));},[]);
  const mutate=async<T,>(action:()=>Promise<T>)=>{setBusy(true);setError("");try{return await action();}catch(reason){setError(reason instanceof Error?reason.message:"Erro inesperado");throw reason;}finally{setBusy(false);}};
  const addToCart=async(variantId:number,quantity=1)=>{if(!sessionId)return false;try{await mutate(async()=>setCart(await jsonRequest("/api/cart",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:sessionId,variant_id:variantId,quantity})})));return true;}catch{return false;}};
  const updateCartItem=async(itemId:number,quantity:number)=>{if(!sessionId)return;await mutate(async()=>setCart(await jsonRequest("/api/cart",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:sessionId,item_id:itemId,quantity})})));};
  const removeCartItem=async(itemId:number)=>{if(!sessionId)return;await mutate(async()=>setCart(await jsonRequest("/api/cart",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:sessionId,item_id:itemId})})));};
  const isFavorite=(productId?:number)=>Boolean(productId&&favorites.some(item=>item.id===productId));
  const toggleFavorite=async(productId:number)=>{if(!sessionId)return;const method=isFavorite(productId)?"DELETE":"POST";await mutate(async()=>{const data=await jsonRequest("/api/favorites",{method,headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:sessionId,product_id:productId})});setFavorites(data.items);});};
  return <ShopContext.Provider value={{cart,favorites,loading,busy,error,addToCart,updateCartItem,removeCartItem,toggleFavorite,isFavorite}}>{children}</ShopContext.Provider>;
}

export function useShop(){const value=useContext(ShopContext);if(!value)throw new Error("useShop deve ser usado dentro de ShopProvider");return value;}
