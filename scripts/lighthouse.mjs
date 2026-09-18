import { spawn } from "node:child_process";
import { existsSync,mkdirSync } from "node:fs";
import { resolve } from "node:path";

const command=name=>resolve("node_modules",".bin",process.platform==="win32"?`${name}.cmd`:name);
const lighthouseCli=resolve("node_modules","lighthouse","cli","index.js");
const chromePath=process.env.CHROME_PATH||resolve(process.env.LOCALAPPDATA||"","ms-playwright","chromium-1243","chrome-win64","chrome.exe");
const tempPath=resolve(".lighthouse-tmp");mkdirSync(tempPath,{recursive:true});
let server=null;
try{const response=await fetch("http://127.0.0.1:3000/");if(!response.ok)throw new Error()}catch{server=spawn(command("next"),["dev","-H","127.0.0.1"],{shell:process.platform==="win32",stdio:"ignore"})}
const stop=()=>server?.kill();
process.on("exit",stop);process.on("SIGINT",()=>{stop();process.exit(130)});
for(let attempt=0;attempt<60;attempt++){try{const response=await fetch("http://127.0.0.1:3000/");if(response.ok)break}catch{}await new Promise(resolve=>setTimeout(resolve,1000))}
for(const [name,url] of [["home","http://127.0.0.1:3000/"],["catalogo","http://127.0.0.1:3000/capacetes"]]){
  const output=resolve(`lighthouse-${name}.html`);
  await new Promise((resolvePromise,reject)=>{const child=spawn(process.execPath,[lighthouseCli,url,"--quiet","--chrome-flags=--headless=new --no-sandbox --disable-gpu","--only-categories=performance,accessibility,best-practices,seo",`--output-path=${output}`,"--output=html"],{env:{...process.env,CHROME_PATH:chromePath,TMP:tempPath,TEMP:tempPath},stdio:"inherit"});child.on("exit",code=>code===0||existsSync(output)?resolvePromise():reject(new Error(`Lighthouse falhou: ${code}`)))})
}
stop();
