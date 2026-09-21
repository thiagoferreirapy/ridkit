const base=process.env.APP_URL||"http://localhost:3000";
const checks=[["health","/api/health"],["catalog","/api/catalog"],["products","/api/products?limit=1"],["home","/"],["catalog page","/capacetes"],["checkout","/checkout/pagamento"],["robots","/robots.txt"],["sitemap","/sitemap.xml"]];
let failed=0;
for(const [name,path] of checks){try{const response=await fetch(`${base}${path}`);if(!response.ok)throw new Error(`HTTP ${response.status}`);console.log(`✓ ${name}`);}catch(error){failed++;console.error(`✗ ${name}: ${error.message}`);}}
if(failed)process.exitCode=1;

const protectedChecks=[["customer account","/api/account"],["pix payment","/api/payments/pix?order_id=1"]];
for(const [name,path] of protectedChecks){try{const response=await fetch(`${base}${path}`);if(response.status!==401)throw new Error(`esperado HTTP 401, recebido ${response.status}`);console.log(`✓ ${name} protegido`);}catch(error){failed++;console.error(`✗ ${name}: ${error.message}`);}}
if(failed)process.exitCode=1;
