type Option = { name?: string; slug?: string };
export function resolveSearchFilters(query: string, brands: Option[], categories: Option[]) {
  const term = query.trim().toLocaleLowerCase("pt-BR");
  const matches = (item: Option) => !!term && [item.name, item.slug].some(value => value?.toLocaleLowerCase("pt-BR") === term);
  const brand = brands.find(matches);
  if (brand) return { brand: brand.slug };
  const category = categories.find(matches);
  return category ? { category: category.slug } : {};
}

// Exact brand/category searches must not match unrelated product descriptions.
export function productSearch(query: string, brands: Option[], categories: Option[]) {
  const filters = resolveSearchFilters(query, brands, categories);
  if (filters.brand) return { sql: "b.slug = ?", params: [filters.brand] };
  if (filters.category) return { sql: "c.slug = ?", params: [filters.category] };
  const terms = query.trim().split(/\s+/).filter(Boolean);
  const fields = ["p.name", "p.description", "p.sku", "b.name", "c.name"];
  return {
    sql: terms.length ? terms.map(() => `(${fields.map(field => `${field} LIKE ? ESCAPE '\\' COLLATE NOCASE`).join(" OR ")})`).join(" AND ") : "1=1",
    params: terms.flatMap(term => fields.map(() => `%${term.replace(/[\\%_]/g, "\\$&")}%`)),
  };
}

export function mergePopularSearches(history: {query: string}[], brands: {query: string}[]) {
  const seen = new Set<string>();
  return [...history, ...brands].filter(item => {
    const key = item.query.trim().toLocaleLowerCase("pt-BR");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 12);
}
