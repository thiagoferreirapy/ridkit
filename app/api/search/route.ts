import { getDb } from "@/lib/db";
import { apiError, ok } from "@/lib/api";

export const runtime = "nodejs";

type SearchItem={id:number;slug:string;name:string;brand:string;category:string;price_cents:number;image_url?:string};
const normalize=(value:string)=>value.trim().replace(/\s+/g," ").slice(0,80);
function searchDb(){const db=getDb();db.exec(`CREATE TABLE IF NOT EXISTS search_history (id INTEGER PRIMARY KEY AUTOINCREMENT,session_id TEXT NOT NULL,query TEXT NOT NULL,results_count INTEGER NOT NULL DEFAULT 0,searched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(session_id,query)) STRICT; CREATE INDEX IF NOT EXISTS idx_search_history_session ON search_history(session_id,searched_at DESC);`);return db;}

function findProducts(query:string,limit=8){
  const term=`%${query}%`; return getDb().prepare(`SELECT p.id,p.slug,p.name,p.price_cents,b.name AS brand,c.name AS category,
    (SELECT url FROM product_images WHERE product_id=p.id ORDER BY position LIMIT 1) AS image_url
    FROM products p JOIN brands b ON b.id=p.brand_id JOIN categories c ON c.id=p.category_id
    WHERE p.active=1 AND (p.name LIKE ? COLLATE NOCASE OR p.description LIKE ? COLLATE NOCASE OR p.sku LIKE ? COLLATE NOCASE OR b.name LIKE ? COLLATE NOCASE OR c.name LIKE ? COLLATE NOCASE)
    ORDER BY p.featured DESC,p.rating DESC,p.id ASC LIMIT ?`).all(term,term,term,term,term,limit) as SearchItem[];
}

export async function GET(request:Request){
  try{
    const url=new URL(request.url); const query=normalize(url.searchParams.get("q")||""); const sessionId=normalize(url.searchParams.get("session_id")||"");
    const limit=Math.min(12,Math.max(1,Number(url.searchParams.get("limit"))||8)); const db=searchDb();
    const recent=sessionId?db.prepare("SELECT query,results_count,searched_at FROM search_history WHERE session_id=? ORDER BY searched_at DESC LIMIT 6").all(sessionId):[];
    const popular=db.prepare(`SELECT query,SUM(results_count+1) AS score FROM search_history GROUP BY lower(query) ORDER BY score DESC,MAX(searched_at) DESC LIMIT 6`).all();
    const fallback=db.prepare(`SELECT b.name AS query,COUNT(p.id) AS score FROM brands b JOIN products p ON p.brand_id=b.id AND p.active=1 GROUP BY b.id ORDER BY COUNT(p.id) DESC,b.name LIMIT 6`).all();
    return ok({query,items:query.length>=2?findProducts(query,limit):[],recent,popular:popular.length?popular:fallback});
  }catch(error){return apiError(error);}
}

export async function POST(request:Request){
  try{
    const body=await request.json(); const sessionId=normalize(String(body.session_id||"")); const query=normalize(String(body.query||""));
    if(!sessionId||query.length<2) return apiError(new Error("VALIDATION:Informe uma busca com ao menos 2 caracteres"));
    const items=findProducts(query,48); searchDb().prepare(`INSERT INTO search_history(session_id,query,results_count,searched_at) VALUES(?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(session_id,query) DO UPDATE SET results_count=excluded.results_count,searched_at=CURRENT_TIMESTAMP`).run(sessionId,query,items.length);
    return ok({query,results_count:items.length});
  }catch(error){return apiError(error);}
}

export async function DELETE(request:Request){
  try{const sessionId=normalize(new URL(request.url).searchParams.get("session_id")||"");if(sessionId)searchDb().prepare("DELETE FROM search_history WHERE session_id=?").run(sessionId);return ok({cleared:true});}
  catch(error){return apiError(error);}
}
