export async function register(){
  if(process.env.NEXT_RUNTIME!=="nodejs")return;
  const {expireOrphanReservations}=await import("@/lib/reservation-expiry");
  const {logger}=await import("@/lib/logger");
  const run=()=>{try{expireOrphanReservations()}catch(error){logger.error("reservations.scheduler_failed",error)}};
  run();
  const timer=setInterval(run,5*60_000);
  timer.unref();
  logger.info("reservations.scheduler_started",{interval_minutes:5});
}

export async function onRequestError(error:unknown,request:{path:string;method:string},context:{routePath:string;routeType:string}){
  if(process.env.NEXT_RUNTIME!=="nodejs")return;
  const {logger}=await import("@/lib/logger");
  logger.error("next.request.failed",error,{method:request.method,path:request.path,route:context.routePath,route_type:context.routeType});
}
