type Context = Record<string, unknown>;

function write(level:"info"|"warn"|"error",event:string,context:Context={}) {
  const entry={timestamp:new Date().toISOString(),level,event,...context};
  const output=JSON.stringify(entry);
  if(level==="error")console.error(output); else if(level==="warn")console.warn(output); else console.info(output);
}

export const logger={
  info:(event:string,context?:Context)=>write("info",event,context),
  warn:(event:string,context?:Context)=>write("warn",event,context),
  error:(event:string,error:unknown,context:Context={})=>write("error",event,{...context,error:error instanceof Error?error.message:String(error)}),
};
