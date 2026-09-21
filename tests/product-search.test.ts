import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { productSearch, resolveSearchFilters, mergePopularSearches } from "../lib/product-search.ts";

const brands=[{name:"Bell",slug:"bell"},{name:"LS2",slug:"ls2"}];
const categories=[{name:"Acessórios",slug:"acessorios"},{name:"Fechados",slug:"fechados"}];
function results(query:string,extra="1=1",params:string[]=[]){
  const db=new DatabaseSync(":memory:");
  try {
    db.exec(`CREATE TABLE brands(id INTEGER,name TEXT,slug TEXT); CREATE TABLE categories(id INTEGER,name TEXT,slug TEXT);
      CREATE TABLE products(id INTEGER,name TEXT,description TEXT,sku TEXT,brand_id INTEGER,category_id INTEGER,size TEXT);
      INSERT INTO brands VALUES(1,'Bell','bell'),(2,'LS2','ls2');
      INSERT INTO categories VALUES(1,'Acessórios','acessorios'),(2,'Fechados','fechados');
      INSERT INTO products VALUES(1,'Qualifier','Capacete','B1',1,2,'M'),(2,'Viseira','Compatível com Bell','L1',2,1,'Único'),(3,'Viseira Bell','100% original','B2',1,1,'Único');`);
    const search=productSearch(query,brands,categories);
    return db.prepare(`SELECT p.id FROM products p JOIN brands b ON b.id=p.brand_id JOIN categories c ON c.id=p.category_id WHERE (${search.sql}) AND (${extra}) ORDER BY p.id`).all(...search.params,...params).map(row=>row.id);
  } finally {db.close();}
}
test("Bell seleciona a marca e não produtos de outra marca que citam Bell",()=>{
  assert.deepEqual(resolveSearchFilters(" BELL ",brands,categories),{brand:"bell"});
  assert.deepEqual(results("Bell"),[1,3]);
});
test("busca, categoria e tamanho são combinados sem fallback para todo o catálogo",()=>{
  assert.deepEqual(results("Bell","c.slug=? AND p.size=?",["acessorios","Único"]),[3]);
  assert.deepEqual(results("Bell","c.slug=? AND p.size=?",["acessorios","M"]),[]);
  assert.deepEqual(results("Qualifier Bell"),[1]);
  assert.deepEqual(results("inexistente"),[]);
});
test("categoria por nome ou slug vira filtro",()=>{
  assert.deepEqual(resolveSearchFilters("ACESSÓRIOS",brands,categories),{category:"acessorios"});
  assert.deepEqual(results("acessorios"),[2,3]);
});
test("caracteres de LIKE são literais",()=>{
  assert.deepEqual(results("%"),[3]);
  assert.deepEqual(results("_"),[]);
});
test("primeira busca não apaga as outras marcas populares",()=>{
  assert.deepEqual(mergePopularSearches([{query:"bell"}],[{query:"Bell"},{query:"LS2"},{query:"Norisk"}]),[{query:"bell"},{query:"LS2"},{query:"Norisk"}]);
});
