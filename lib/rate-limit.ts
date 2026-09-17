type Entry={count:number;resetAt:number};
const globalStore=globalThis as unknown as {ridekitRateLimits?:Map<string,Entry>};
const store=globalStore.ridekitRateLimits??=new Map<string,Entry>();

export function clientIp(request:Request){return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||request.headers.get("x-real-ip")||"local";}

export function assertRateLimit(request:Request,scope:string,limit=10,windowMs=60_000){
  const now=Date.now(),key=`${scope}:${clientIp(request)}`,current=store.get(key);
  if(!current||current.resetAt<=now){store.set(key,{count:1,resetAt:now+windowMs});return;}
  if(current.count>=limit)throw new Error("TOO_MANY_REQUESTS");
  current.count+=1;
}
