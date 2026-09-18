import { randomUUID } from "node:crypto";
import { mkdir,writeFile } from "node:fs/promises";
import path from "node:path";
import { apiError,created } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { assertRateLimit } from "@/lib/rate-limit";

export const runtime="nodejs";
const types:Record<string,{extension:string;max:number;valid:(bytes:Uint8Array)=>boolean}>={
  "image/jpeg":{extension:"jpg",max:5*1024*1024,valid:bytes=>[0xff,0xd8,0xff].every((byte,index)=>bytes[index]===byte)},
  "image/png":{extension:"png",max:5*1024*1024,valid:bytes=>[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((byte,index)=>bytes[index]===byte)},
  "image/webp":{extension:"webp",max:5*1024*1024,valid:bytes=>String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP"},
  "video/mp4":{extension:"mp4",max:25*1024*1024,valid:bytes=>String.fromCharCode(...bytes.slice(4,8))==="ftyp"},
  "video/webm":{extension:"webm",max:25*1024*1024,valid:bytes=>[0x1a,0x45,0xdf,0xa3].every((byte,index)=>bytes[index]===byte)},
};
export async function POST(request:Request){try{assertRateLimit(request,"review-image",10,60*60_000);await requireUser();const form=await request.formData(),file=form.get("file");if(!(file instanceof File))throw new Error("BAD_REQUEST:Selecione uma foto ou vídeo");const type=types[file.type];if(!type||file.size===0||file.size>type.max)throw new Error("BAD_REQUEST:Use JPG, PNG ou WebP com até 5 MB, ou MP4/WebM com até 25 MB");const bytes=new Uint8Array(await file.arrayBuffer());if(!type.valid(bytes))throw new Error("BAD_REQUEST:O conteúdo do arquivo não corresponde ao formato informado");const directory=path.join(process.cwd(),"public","uploads","reviews"),filename=`${Date.now()}-${randomUUID()}.${type.extension}`;await mkdir(directory,{recursive:true});await writeFile(path.join(directory,filename),bytes);return created({url:`/uploads/reviews/${filename}`,media_type:file.type.startsWith("video/")?"video":"image"});}catch(error){return apiError(error)}}
