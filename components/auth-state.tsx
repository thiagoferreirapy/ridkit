"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { safeNextPath } from "@/lib/client-utils";

export type AuthUser={id:number;name:string;email:string};
type Credentials={email:string;password:string};
type Registration=Credentials&{name:string;phone?:string;cpf:string;legal_version:string;accept_terms:true;acknowledge_privacy:true};
type RegistrationResult={requiresVerification:boolean;email:string;emailSent:boolean};
type AuthState={user:AuthUser|null;loading:boolean;login:(value:Credentials,next?:string)=>Promise<void>;register:(value:Registration)=>Promise<RegistrationResult>;logout:()=>Promise<void>;finishAccountClosure:()=>void;authFetch:(url:string,init?:RequestInit)=>Promise<Response>};
const AuthContext=createContext<AuthState|null>(null);

async function payload(response:Response){const value=await response.json();if(!response.ok)throw new Error(value.error||"Não foi possível concluir a autenticação");return value.data;}
export async function fetchWithRefresh(url:string,init?:RequestInit){const response=await fetch(url,init);if(response.status!==401||url.includes("/api/auth/"))return response;const refreshed=await fetch("/api/auth/refresh",{method:"POST"});if(!refreshed.ok)return response;return fetch(url,init);}

export function AuthProvider({children}:{children:React.ReactNode}){
  const router=useRouter();const [user,setUser]=useState<AuthUser|null>(null);const [loading,setLoading]=useState(true);
  useEffect(()=>{let active=true;(async()=>{let response=await fetch("/api/auth/me");if(response.status===401){const refresh=await fetch("/api/auth/refresh",{method:"POST"});if(refresh.ok)response=await fetch("/api/auth/me");}if(active&&response.ok)setUser((await response.json()).data.user);if(active)setLoading(false);})();return()=>{active=false;};},[]);
  const login=useCallback(async(value:Credentials,next="/")=>{const data=await payload(await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(value)}));setUser(data.user);sessionStorage.setItem("ridekit-auth-welcome",JSON.stringify({kind:"login",name:data.user.name}));router.push(safeNextPath(next));router.refresh();},[router]);
  const register=useCallback(async(value:Registration)=>{const data=await payload(await fetch("/api/auth/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(value)}));return {requiresVerification:Boolean(data.requires_verification),email:String(data.email),emailSent:Boolean(data.email_sent)};},[]);
  const logout=useCallback(async()=>{await fetch("/api/auth/logout",{method:"POST"});setUser(null);router.push("/login");router.refresh();},[router]);
  const finishAccountClosure=useCallback(()=>{setUser(null);localStorage.removeItem("ridekit-session-id");router.refresh();},[router]);
  const authFetch=useCallback(async(url:string,init?:RequestInit)=>{const response=await fetchWithRefresh(url,init);if(response.status===401)setUser(null);return response;},[]);
  const value=useMemo(()=>({user,loading,login,register,logout,finishAccountClosure,authFetch}),[user,loading,login,register,logout,finishAccountClosure,authFetch]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth(){const value=useContext(AuthContext);if(!value)throw new Error("useAuth deve ser usado dentro de AuthProvider");return value;}
