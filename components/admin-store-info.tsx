"use client";
import { FormEvent,useEffect,useState } from "react";import { Check,Loader2 } from "lucide-react";import { useAdmin } from "@/components/admin-state";import { ImageUploadField } from "@/components/image-upload-field";import { FormSkeleton } from "@/components/skeletons";import { fillLegalDocument,storeInfoKeys,type StoreInfo } from "@/lib/store-info";import { PRIVACY_POLICY,TERMS_OF_USE } from "@/lib/legal-documents";
const field="mt-2 h-11 w-full rounded-xl border border-line bg-white px-3 text-sm font-normal outline-none focus:border-accent";
type Info=StoreInfo&{store_name:string};
export function AdminStoreInfo(){
  const {adminFetch}=useAdmin(),[data,setData]=useState<Info|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[cepStatus,setCepStatus]=useState("");
  useEffect(()=>{adminFetch("/api/store-settings").then(r=>r.json()).then(body=>setData(body.data)).catch(()=>setMessage("Não foi possível carregar os dados da loja."));},[adminFetch]);
  if(!data)return <div className="mt-7">{message?<p className="text-sm text-danger">{message}</p>:<FormSkeleton/>}</div>;
  const set=(key:keyof Info)=>(event:React.ChangeEvent<HTMLInputElement>)=>setData({...data,[key]:event.target.value});
  const lookupCep=async(value:string)=>{const cep=value.replace(/\D/g,"");if(cep.length!==8)return;setCepStatus("Buscando endereço…");try{const response=await fetch(`/api/cep/${cep}`),body=await response.json();if(!response.ok)throw new Error(body.error||"CEP não encontrado");setData(current=>current&&{...current,address_street:body.data.street||current.address_street,address_district:body.data.district||current.address_district,address_city:body.data.city,address_state:body.data.state});setCepStatus("");}catch(error){setCepStatus(error instanceof Error?error.message:"CEP não encontrado");}};
  const submit=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();setBusy(true);setMessage("");try{const raw=Object.fromEntries(new FormData(event.currentTarget)),body=Object.fromEntries(storeInfoKeys.map(key=>[key,String(raw[key]??"")])),response=await adminFetch("/api/store-info",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}),result=await response.json();if(response.ok){setData(result.data);setMessage("Dados salvos. Rodapé, contato e documentos legais já mostram as informações novas.");}else setMessage(result.error||"Erro ao salvar");}catch{setMessage("Falha de conexão. Verifique a internet e tente novamente.");}finally{setBusy(false);}};
  const missing=[...new Set([...fillLegalDocument(TERMS_OF_USE,data).missing,...fillLegalDocument(PRIVACY_POLICY,data).missing])];
  const Text=({name,label,type="text",placeholder,wide,autoComplete}:{name:keyof Info;label:string;type?:string;placeholder?:string;wide?:boolean;autoComplete?:string})=><label className={`text-xs font-semibold ${wide?"sm:col-span-2":""}`}>{label}<input name={name} type={type} value={String(data[name]??"")} onChange={set(name)} placeholder={placeholder} autoComplete={autoComplete} className={field}/></label>;
  return <form onSubmit={submit} className="mt-7 grid gap-6 xl:grid-cols-[1fr_360px]"><div className="grid gap-6">
    <section className="card grid gap-4 p-6 sm:grid-cols-2"><div className="sm:col-span-2"><h2 className="font-semibold">Empresa</h2><p className="mt-1 text-xs text-muted">Aparece no rodapé, nos Termos de Uso e na Política de Privacidade. O nome fantasia ({data.store_name}) é alterado em Configurações.</p></div>
      {Text({name:"legal_name",label:"Razão social",placeholder:"Ridekit Comércio de Acessórios LTDA",wide:true,autoComplete:"organization"})}
      {Text({name:"cnpj",label:"CNPJ",placeholder:"00.000.000/0000-00"})}
      {Text({name:"state_registration",label:"Inscrição estadual",placeholder:"Isento ou número"})}
    </section>
    <section className="card grid gap-4 p-6 sm:grid-cols-2"><h2 className="sm:col-span-2 font-semibold">Contato</h2>
      {Text({name:"support_email",label:"E-mail de atendimento",type:"email",placeholder:"ajuda@suadominio.com.br"})}
      {Text({name:"privacy_email",label:"E-mail de privacidade (LGPD)",type:"email",placeholder:"privacidade@suadominio.com.br"})}
      {Text({name:"phone",label:"Telefone",type:"tel",placeholder:"(11) 3333-4444",autoComplete:"tel"})}
      {Text({name:"business_hours",label:"Horário de atendimento",placeholder:"Segunda a sexta, das 9h às 18h"})}
      <p className="sm:col-span-2 text-xs text-muted">O WhatsApp da loja continua em Configurações. Mensagens do formulário de contato vão para o e-mail de atendimento.</p>
    </section>
    <section className="card grid gap-4 p-6 sm:grid-cols-6"><h2 className="sm:col-span-6 font-semibold">Endereço</h2>
      <label className="text-xs font-semibold sm:col-span-2">CEP<input name="address_zip" value={data.address_zip} onChange={set("address_zip")} onBlur={event=>lookupCep(event.target.value)} inputMode="numeric" placeholder="00000-000" autoComplete="postal-code" className={field}/>{cepStatus&&<span role="status" className="mt-1 block font-normal text-muted">{cepStatus}</span>}</label>
      <label className="text-xs font-semibold sm:col-span-4">Rua<input name="address_street" value={data.address_street} onChange={set("address_street")} autoComplete="address-line1" className={field}/></label>
      <label className="text-xs font-semibold sm:col-span-2">Número<input name="address_number" value={data.address_number} onChange={set("address_number")} className={field}/></label>
      <label className="text-xs font-semibold sm:col-span-4">Complemento<input name="address_complement" value={data.address_complement} onChange={set("address_complement")} autoComplete="address-line2" className={field}/></label>
      <label className="text-xs font-semibold sm:col-span-2">Bairro<input name="address_district" value={data.address_district} onChange={set("address_district")} className={field}/></label>
      <label className="text-xs font-semibold sm:col-span-3">Cidade<input name="address_city" value={data.address_city} onChange={set("address_city")} autoComplete="address-level2" className={field}/></label>
      <label className="text-xs font-semibold sm:col-span-1">UF<input name="address_state" value={data.address_state} onChange={set("address_state")} maxLength={2} autoComplete="address-level1" className={`${field} uppercase`}/></label>
    </section>
    <section className="card grid gap-4 p-6 sm:grid-cols-2"><div className="sm:col-span-2"><h2 className="font-semibold">Marca</h2><p className="mt-1 text-xs text-muted">Sem logo, o cabeçalho mostra o nome da loja em texto. Use imagem horizontal com fundo transparente.</p></div>
      <div className="sm:col-span-2"><ImageUploadField key={data.logo_url} name="logo_url" label="Logo" defaultValue={data.logo_url} wide/></div>
      {Text({name:"site_url",label:"Site oficial",type:"url",placeholder:"https://www.suadominio.com.br",wide:true})}
    </section>
    <section className="card grid gap-4 p-6 sm:grid-cols-2"><div className="sm:col-span-2"><h2 className="font-semibold">Redes sociais</h2><p className="mt-1 text-xs text-muted">Só as preenchidas aparecem no rodapé.</p></div>
      {Text({name:"instagram_url",label:"Instagram",type:"url",placeholder:"https://instagram.com/sualoja"})}
      {Text({name:"facebook_url",label:"Facebook",type:"url",placeholder:"https://facebook.com/sualoja"})}
      {Text({name:"tiktok_url",label:"TikTok",type:"url",placeholder:"https://tiktok.com/@sualoja"})}
      {Text({name:"youtube_url",label:"YouTube",type:"url",placeholder:"https://youtube.com/@sualoja"})}
    </section>
  </div><aside className="card h-fit p-5"><b>Publicar dados da loja</b>{missing.length?<p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-amber-950">Os documentos legais ainda têm campos em branco: {missing.join(", ")}.</p>:<p className="mt-3 text-xs leading-5 text-muted">Os documentos legais estão com todos os dados da empresa preenchidos.</p>}<button disabled={busy} className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white disabled:opacity-50">{busy?<Loader2 className="animate-spin" size={16}/>:<Check size={16}/>}Salvar dados da loja</button>{message&&<p role="status" className="mt-4 text-xs leading-5 text-muted">{message}</p>}</aside></form>;
}
