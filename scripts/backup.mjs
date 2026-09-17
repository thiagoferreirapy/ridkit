import { copyFile, cp, mkdir, stat } from "node:fs/promises";
import { resolve } from "node:path";

const stamp = new Date().toISOString().replaceAll(":","-").replaceAll(".","-");
const destination = resolve("backups",stamp);
await mkdir(destination,{recursive:true});

for (const file of ["data/ridekit.db","data/ridekit.db-wal","data/ridekit.db-shm"]) {
  try { await stat(file); await copyFile(file,resolve(destination,file.split("/").pop())); } catch {}
}
try { await stat("public/uploads"); await cp("public/uploads",resolve(destination,"uploads"),{recursive:true}); } catch {}

console.log(JSON.stringify({level:"info",event:"backup.completed",destination,timestamp:new Date().toISOString()}));
