"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type AuthUser={id:number;name:string;email:string};
type Credentials={email:string;password:string};
type Registration=Credentials&{name:string;phone?:string;cpf:string};
type RegistrationResult={requiresVerification:boolean;email:string;emailSent:boolean};
type AuthState={user:AuthUser|null;loading:boolean;login:(value:Credentials)=>Promise<void>;register:(value:Registration)=>Promise<RegistrationResult>;logout:()=>Promise<void>;authFetch:(url:string,init?:RequestInit)=>Promise<Response>};
const AuthContext=createContext<AuthState|null>(null);

async function payload(response:Response){const value=await response.json();if(!response.ok)throw new Error(value.error||"Não foi possível concluir a autenticação");return value.data;}
export async function fetchWithRefresh(url:string,init?:RequestInit){let response=await fetch(url,init);if(response.status!==401||url.includes("/api/auth/"))return response;const refreshed=await fetch("/api/auth/refresh",{method:"POST"});if(!refreshed.ok)return response;return fetch(url,init);}

export function AuthProvider({children}:{children:React.ReactNode}){
  const router=useRouter();const [user,setUser]=useState<AuthUser|null>(null);const [loading,setLoading]=useState(true);
  useEffect(()=>{let active=true;(async()=>{let response=await fetch("/api/auth/me");if(response.status===401){const refresh=await fetch("/api/auth/refresh",{method:"POST"});if(refresh.ok)response=await fetch("/api/auth/me");}if(active&&response.ok)setUser((await response.json()).data.user);if(active)setLoading(false);})();return()=>{active=false;};},[]);
  const login=async(value:Credentials)=>{const data=await payload(await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(value)}));setUser(data.user);sessionStorage.setItem("ridekit-auth-welcome",JSON.stringify({kind:"login",name:data.user.name}));router.push("/");router.refresh();};
  const register=async(value:Registration)=>{const data=await payload(await fetch("/api/auth/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(value)}));return {requiresVerification:Boolean(data.requires_verification),email:String(data.email),emailSent:Boolean(data.email_sent)};};
  const logout=async()=>{await fetch("/api/auth/logout",{method:"POST"});setUser(null);router.push("/login");router.refresh();};
  const authFetch=async(url:string,init?:RequestInit)=>{const response=await fetchWithRefresh(url,init);if(response.status===401)setUser(null);return response;};
  return <AuthContext.Provider value={{user,loading,login,register,logout,authFetch}}>{children}</AuthContext.Provider>;
}
export function useAuth(){const value=useContext(AuthContext);if(!value)throw new Error("useAuth deve ser usado dentro de AuthProvider");return value;}
