type Entry={count:number;resetAt:number};
const globalStore=globalThis as unknown as {ridekitRateLimits?:Map<string,Entry>;ridekitRateLimitCalls?:number};
const store=globalStore.ridekitRateLimits??=new Map<string,Entry>();

// Next only fills X-Forwarded-For from the socket when the client did not send one, so without a
// proxy that overwrites it the value is attacker-controlled. Per-account and global limits below
// are what actually stop distributed or spoofed brute force; the IP limit is a first filter.
export function clientIp(request:Request){
  if(process.env.TRUSTED_PROXY==="1"){const realIp=request.headers.get("x-real-ip");if(realIp)return realIp.trim();}
  const forwarded=request.headers.get("x-forwarded-for")?.split(",").map(part=>part.trim()).filter(Boolean);
  return forwarded?.at(-1)||request.headers.get("x-real-ip")||"local";
}

function prune(now:number){
  globalStore.ridekitRateLimitCalls=(globalStore.ridekitRateLimitCalls||0)+1;
  if(globalStore.ridekitRateLimitCalls%500!==0)return;
  for(const [key,entry] of store)if(entry.resetAt<=now)store.delete(key);
}

// Test environments replay the same logins many times against one server; never set this in production.
const scale=()=>Math.max(1,Number(process.env.E2E_RATE_LIMIT_SCALE)||1);

function hit(key:string,baseLimit:number,windowMs:number,now:number){
  const current=store.get(key),limit=baseLimit*scale();
  if(!current||current.resetAt<=now){store.set(key,{count:1,resetAt:now+windowMs});return;}
  if(current.count>=limit)throw new Error("TOO_MANY_REQUESTS");
  current.count+=1;
}

export function assertRateLimit(request:Request,scope:string,limit=10,windowMs=60_000){
  const now=Date.now();prune(now);
  hit(`${scope}:global`,limit*50,windowMs,now);
  hit(`${scope}:ip:${clientIp(request)}`,limit,windowMs,now);
}

// Limit keyed by something the attacker cannot rotate (e-mail, customer id, token).
export function assertRateLimitFor(scope:string,key:string,limit:number,windowMs:number){
  const now=Date.now();prune(now);
  hit(`${scope}:key:${key.toLowerCase()}`,limit,windowMs,now);
}

export function resetRateLimitFor(scope:string,key:string){store.delete(`${scope}:key:${key.toLowerCase()}`);}
