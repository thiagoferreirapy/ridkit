"use client";
import { createContext,useCallback,useContext,useEffect,useState } from "react";import { useRouter } from "next/navigation";
type Admin={id:number;name:string;email:string;role:string;permissions:string[]};type State={admin:Admin|null;loading:boolean;login:(email:string,password:string,code?:string)=>Promise<{requires2fa:boolean}>;logout:()=>Promise<void>;adminFetch:(url:string,init?:RequestInit)=>Promise<Response>};
const Context=createContext<State|null>(null);let refreshPromise:Promise<boolean>|null=null;
const request=(url:string,init?:RequestInit)=>fetch(url,{...init,credentials:"same-origin",cache:"no-store"});
function renew(){if(!refreshPromise)refreshPromise=request("/api/admin-auth/refresh",{method:"POST"}).then(response=>response.ok).catch(()=>false).finally(()=>{refreshPromise=null;});return refreshPromise;}
async function currentAdmin(){let response=await request("/api/admin-auth/me");if(response.status===401&&await renew())response=await request("/api/admin-auth/me");if(!response.ok)return null;return (await response.json()).data.user as Admin;}
export function AdminAuthProvider({children}:{children:React.ReactNode}){const router=useRouter(),[admin,setAdmin]=useState<Admin|null>(null),[loading,setLoading]=useState(true);
  const sessionEnded=useCallback(()=>{setAdmin(null);if(window.location.pathname.startsWith("/admin")&&window.location.pathname!=="/admin/login")router.replace("/admin/login?reason=session-ended");},[router]);
  useEffect(()=>{let active=true;currentAdmin().then(user=>{if(!active)return;setAdmin(user);if(!user&&window.location.pathname.startsWith("/admin")&&window.location.pathname!=="/admin/login")router.replace("/admin/login?reason=session-ended");}).finally(()=>active&&setLoading(false));return()=>{active=false;};},[router]);
  useEffect(()=>{const verify=async()=>{if(document.visibilityState!=="visible"||!admin)return;const user=await currentAdmin();if(user)setAdmin(user);else sessionEnded();};const timer=window.setInterval(verify,5*60_000);window.addEventListener("focus",verify);return()=>{window.clearInterval(timer);window.removeEventListener("focus",verify);};},[admin,sessionEnded]);
  const login=async(email:string,password:string,code?:string)=>{const response=await request("/api/admin-auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password,code})}),body=await response.json();if(response.status===428)return{requires2fa:true};if(!response.ok){const error=new Error(body.error) as Error&{requires2fa?:boolean};error.requires2fa=Boolean(body.requires_2fa);throw error}setAdmin(body.data.user);router.replace("/admin");router.refresh();return{requires2fa:false}};
  const logout=async()=>{await request("/api/admin-auth/logout",{method:"POST"});setAdmin(null);router.replace("/admin/login");router.refresh();};
  const adminFetch=async(url:string,init?:RequestInit)=>{let response=await request(url,init);if(response.status===401){if(await renew())response=await request(url,init);if(response.status===401)sessionEnded();}return response;};
  return <Context.Provider value={{admin,loading,login,logout,adminFetch}}>{children}</Context.Provider>;
}
export function useAdmin(){const value=useContext(Context);if(!value)throw new Error("AdminAuthProvider ausente");return value;}
