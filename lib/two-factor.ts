import { createHash,createHmac,randomBytes,timingSafeEqual } from "node:crypto";

const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const createTotpSecret=()=>{const bytes=randomBytes(20);let bits="";for(const byte of bytes)bits+=byte.toString(2).padStart(8,"0");return bits.match(/.{1,5}/g)!.map(chunk=>alphabet[parseInt(chunk.padEnd(5,"0"),2)]).join("")};
function decodeBase32(value:string){let bits="";for(const char of value.replace(/=+$/g,"").toUpperCase()){const index=alphabet.indexOf(char);if(index>=0)bits+=index.toString(2).padStart(5,"0")}const bytes=[];for(let index=0;index+8<=bits.length;index+=8)bytes.push(parseInt(bits.slice(index,index+8),2));return Buffer.from(bytes)}
function totp(secret:string,counter:number){const buffer=Buffer.alloc(8);buffer.writeBigUInt64BE(BigInt(counter));const digest=createHmac("sha1",decodeBase32(secret)).update(buffer).digest(),offset=digest[digest.length-1]&15,value=(digest.readUInt32BE(offset)&0x7fffffff)%1_000_000;return String(value).padStart(6,"0")}
export function verifyTotp(secret:string,code:string,now=Date.now()){const normalized=code.replace(/\D/g,"");if(normalized.length!==6)return false;const counter=Math.floor(now/30_000);for(let drift=-1;drift<=1;drift++){const expected=totp(secret,counter+drift);if(timingSafeEqual(Buffer.from(expected),Buffer.from(normalized)))return true}return false}
export const otpAuthUrl=(secret:string,email:string)=>`otpauth://totp/${encodeURIComponent(`Ridekit Admin:${email}`)}?secret=${secret}&issuer=${encodeURIComponent("Ridekit Admin")}&algorithm=SHA1&digits=6&period=30`;
export const hashRecoveryCode=(code:string)=>createHash("sha256").update(code.replace(/\s|-/g,"").toUpperCase()).digest("hex");
export function createRecoveryCodes(){return Array.from({length:8},()=>`${randomBytes(3).toString("hex").toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`)}
