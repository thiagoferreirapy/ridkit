export type CepAddress={zip_code:string;street:string;complement:string;district:string;city:string;state:string};

export async function lookupCep(value:string):Promise<CepAddress>{
  const cep=value.replace(/\D/g,"");
  if(cep.length!==8)throw new Error("VALIDATION:Informe um CEP válido");
  return viaCep(cep).catch(()=>brasilApi(cep));
}

async function viaCep(cep:string):Promise<CepAddress>{
  const response=await fetch(`https://viacep.com.br/ws/${cep}/json/`,{next:{revalidate:86400}});
  if(!response.ok)throw new Error("ViaCEP indisponível");
  const data=await response.json() as {erro?:boolean;cep?:string;logradouro?:string;complemento?:string;bairro?:string;localidade?:string;uf?:string};
  if(data.erro)throw new Error("NOT_FOUND");
  return {zip_code:data.cep||cep,street:data.logradouro||"",complement:data.complemento||"",district:data.bairro||"",city:data.localidade||"",state:data.uf||""};
}

async function brasilApi(cep:string):Promise<CepAddress>{
  const response=await fetch(`https://brasilapi.com.br/api/cep/v1/${cep}`,{next:{revalidate:86400}});
  if(response.status===404)throw new Error("NOT_FOUND");
  if(!response.ok)throw new Error("BAD_REQUEST:Serviços de CEP indisponíveis");
  const data=await response.json() as {cep:string;street?:string;neighborhood?:string;city?:string;state?:string};
  return {zip_code:data.cep||cep,street:data.street||"",complement:"",district:data.neighborhood||"",city:data.city||"",state:data.state||""};
}
