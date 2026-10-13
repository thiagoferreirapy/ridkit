import { spawn } from "node:child_process";
import { existsSync,mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

// Measures the production build: dev mode scores (unminified, HMR) say nothing about real users.
const base=(process.env.LIGHTHOUSE_URL||"http://127.0.0.1:3000").replace(/\/$/,"");
const lighthouseCli=resolve("node_modules","lighthouse","cli","index.js");
const chromePath=process.env.CHROME_PATH||chromium.executablePath();
if(!existsSync(chromePath)){console.error(`Chrome não encontrado em ${chromePath}. Rode "pnpm exec playwright install chromium" ou defina CHROME_PATH.`);process.exit(1);}
const tempPath=resolve(".lighthouse-tmp");mkdirSync(tempPath,{recursive:true});

let server=null;
const up=async()=>{try{return (await fetch(`${base}/api/health`)).ok}catch{return false}};
if(!await up()){
  if(!existsSync(resolve(".next","BUILD_ID"))){console.error('Nenhum servidor em execução e nenhum build encontrado. Rode "pnpm build" primeiro.');process.exit(1);}
  const port=new URL(base).port||"3000";
  server=spawn(process.execPath,[resolve("node_modules","next","dist","bin","next"),"start","-H","127.0.0.1","-p",port],{stdio:"ignore"});
}
const stop=()=>server?.kill();
process.on("exit",stop);process.on("SIGINT",()=>{stop();process.exit(130)});
for(let attempt=0;attempt<60&&!await up();attempt++)await new Promise(done=>setTimeout(done,1000));

for(const [name,path] of [["home","/"],["catalogo","/capacetes"]]){
  const output=resolve(`lighthouse-${name}.html`);
  await new Promise((done,reject)=>{const child=spawn(process.execPath,[lighthouseCli,`${base}${path}`,"--quiet","--chrome-flags=--headless=new --no-sandbox --disable-gpu","--only-categories=performance,accessibility,best-practices,seo",`--output-path=${output}`,"--output=html"],{env:{...process.env,CHROME_PATH:chromePath,TMP:tempPath,TEMP:tempPath},stdio:"inherit"});child.on("exit",code=>code===0||existsSync(output)?done():reject(new Error(`Lighthouse falhou: ${code}`)))});
  console.log(`Relatório: ${output}`);
}
stop();
