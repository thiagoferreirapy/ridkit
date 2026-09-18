"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { useAdmin } from "@/components/admin-state";
import { ImageUploadField } from "@/components/image-upload-field";
import { FormSkeleton } from "@/components/skeletons";

type Item = Record<string, any>;
type Variant = {
  id?: number;
  sku: string;
  value: string;
  color: string;
  stock: number;
  reserved_stock: number;
  price_cents?: number | null;
  active: number;
};
const input =
  "mt-2 h-11 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-accent";
const button =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50";
async function json(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Não foi possível salvar");
  return body.data;
}
const blankVariant = (sku = "", color = ""): Variant => ({
  sku,
  value: "",
  color,
  stock: 0,
  reserved_stock: 0,
  price_cents: null,
  active: 1,
});

export function AdminProductFormV2({ id }: { id?: string }) {
  const { adminFetch } = useAdmin();
  const [catalog, setCatalog] = useState<{
    brands: Item[];
    categories: Item[];
  }>({ brands: [], categories: [] });
  const [product, setProduct] = useState<Item | null>(id ? null : {});
  const [categoryId, setCategoryId] = useState("");
  const [variants, setVariants] = useState<Variant[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    Promise.all([
      fetch("/api/catalog").then(json),
      id ? fetch(`/api/products/${id}`).then(json) : Promise.resolve({}),
    ]).then(([catalogData, productData]) => {
      setCatalog(catalogData);
      setProduct(productData);
      setCategoryId(String(productData.category_id || ""));
      setVariants(
        (productData.variants || []).map((variant: Item) => ({
          id: variant.id,
          sku: variant.sku,
          value: variant.size,
          color: variant.color,
          stock: variant.stock,
          reserved_stock: variant.reserved_stock,
          price_cents: variant.price_cents,
          active: variant.active,
        })),
      );
    });
  }, [id]);
  const category = useMemo(
    () => catalog.categories.find((item) => String(item.id) === categoryId),
    [catalog, categoryId],
  );
  const mode = category?.variation_type || "none";
  const optionLabel =
    mode === "size" ? "Tamanho" : category?.variation_label || "Opção";
  useEffect(() => {
    if (!categoryId || id) return;
    setVariants(
      mode === "none"
        ? [{ ...blankVariant(), value: "Único" }]
        : [{ ...blankVariant() }],
    );
  }, [categoryId, mode, id]);
  if (!product)
    return (
      <div className="mt-7">
        <FormSkeleton />
      </div>
    );
  const updateVariant = (index: number, field: keyof Variant, value: any) =>
    setVariants((current) =>
      current.map((variant, i) =>
        i === index
          ? { ...variant, [field]: field === "stock" ? Number(value) : value }
          : variant,
      ),
    );
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const baseSku = String(values.sku);
    const color = String(values.color);
    const attributes=String(values.attributes||"").split("\n").map(line=>line.split(":" )).filter(parts=>parts.length>1&&parts[0].trim()&&parts.slice(1).join(":").trim()).map(parts=>({name:parts[0].trim(),value:parts.slice(1).join(":").trim()}));
    let finalVariants = variants.length
      ? variants
      : [{ ...blankVariant(), value: "Único" }];
    if (mode === "none")
      finalVariants = [
        { ...(finalVariants[0] || blankVariant()), value: "Único" },
      ];
    const body = {
      brand_id: values.brand_id,
      category_id: values.category_id,
      name: values.name,
      slug: values.slug || undefined,
      sku: baseSku,
      description: values.description,
      price_cents: Math.round(Number(values.price) * 100),
      compare_at_cents:
        Number(values.compare_price) > 0
          ? Math.round(Number(values.compare_price) * 100)
          : null,
      offer_starts_at: values.offer_starts_at || null,
      offer_ends_at: values.offer_ends_at || null,
      cost_cents: Math.round(Number(values.cost || 0) * 100),
      color,
      finish: values.finish || null,
      shell_material: values.shell_material || null,
      weight_grams: values.weight_grams || null,
      solar_visor: values.solar_visor ? 1 : 0,
      pinlock_ready: values.pinlock_ready ? 1 : 0,
      featured: values.featured ? 1 : 0,
      is_new: values.is_new ? 1 : 0,
      launch_starts_at: values.launch_starts_at || null,
      launch_ends_at: values.launch_ends_at || null,
      active: values.publication_status === "active" ? 1 : 0,
      publication_status: values.publication_status,
      seo_title: values.seo_title || null,
      seo_description: values.seo_description || null,
      seo_image_url: values.seo_image_url || null,
      attributes,
      images: values.image_url
        ? [{ url: String(values.image_url), alt: String(values.name) }]
        : [],
      variants: finalVariants.map((variant, index) => ({
        id: variant.id,
        sku: variant.sku || `${baseSku}-${index + 1}`,
        size: variant.value || "Único",
        color: variant.color || color,
        stock: variant.stock,
        reserved_stock: variant.reserved_stock || 0,
        price_cents: variant.price_cents ?? null,
        active: variant.active,
      })),
    };
    try {
      const result = await json(
        await adminFetch(id ? `/api/products/${id}` : "/api/products", {
          method: id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
      setMessage("Produto salvo com sucesso.");
      if (!id) window.location.href = `/admin/produtos/editar?id=${result.id}`;
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      onSubmit={submit}
      className="mt-7 grid gap-6 xl:grid-cols-[1fr_340px]"
    >
      <div className="card grid gap-4 p-6 md:grid-cols-2">
        <Field name="name" label="Nome" value={product.name} required wide />
        <Field name="slug" label="Slug" value={product.slug} />
        <Field name="sku" label="SKU base" value={product.sku} required />
        <Select
          name="brand_id"
          label="Marca"
          value={product.brand_id}
          options={catalog.brands}
        />
        <label className="text-xs font-semibold">
          Categoria
          <select
            name="category_id"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            required
            className={input}
          >
            <option value="">Selecione</option>
            {catalog.categories.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <Field
          name="price"
          label="Preço"
          type="number"
          step="0.01"
          value={product.price_cents ? product.price_cents / 100 : ""}
          required
        />
        <Field
          name="compare_price"
          label="Preço anterior / de"
          type="number"
          step="0.01"
          value={product.compare_at_cents ? product.compare_at_cents / 100 : ""}
        />
        <Field
          name="offer_starts_at"
          label="Início da oferta"
          type="datetime-local"
          value={toDateTimeLocal(product.offer_starts_at)}
        />
        <Field
          name="offer_ends_at"
          label="Fim da oferta"
          type="datetime-local"
          value={toDateTimeLocal(product.offer_ends_at)}
        />
        <Field
          name="launch_starts_at"
          label="Início como lançamento"
          type="datetime-local"
          value={toDateTimeLocal(product.launch_starts_at)}
        />
        <Field
          name="launch_ends_at"
          label="Fim como lançamento"
          type="datetime-local"
          value={toDateTimeLocal(product.launch_ends_at)}
        />
        <Field
          name="cost"
          label="Custo"
          type="number"
          step="0.01"
          value={product.cost_cents ? product.cost_cents / 100 : 0}
        />
        <Field
          name="color"
          label="Cor principal"
          value={product.color}
          required
        />
        <Field name="finish" label="Acabamento" value={product.finish} />
        <Field
          name="shell_material"
          label="Material"
          value={product.shell_material}
        />
        <Field
          name="weight_grams"
          label="Peso (g)"
          type="number"
          value={product.weight_grams}
        />
        <label className="text-xs font-semibold md:col-span-2">
          Descrição
          <textarea
            name="description"
            required
            defaultValue={product.description || ""}
            className="mt-2 h-32 w-full rounded-xl border border-line p-3 text-sm"
          />
        </label>
        <Field
          name="image_url"
          label="Imagem principal"
          type="url"
          value={product.images?.[0]?.url}
          wide
        />
        <Field
          name="seo_title"
          label="Título SEO (até 70 caracteres)"
          value={product.seo_title}
          wide
        />
        <label className="text-xs font-semibold md:col-span-2">
          Descrição SEO (até 170 caracteres)
          <textarea
            name="seo_description"
            maxLength={170}
            defaultValue={product.seo_description || ""}
            className="mt-2 h-24 w-full rounded-xl border border-line p-3 text-sm"
          />
        </label>
        <Field
          name="seo_image_url"
          label="Imagem social/SEO"
          type="url"
          value={product.seo_image_url}
          wide
        />
        <label className="text-xs font-semibold md:col-span-2">
          Especificações técnicas
          <textarea name="attributes" defaultValue={(product.attributes||[]).map((item:Item)=>`${item.name}: ${item.value}`).join("\n")} placeholder={"Material: Fibra de carbono\nCertificação: ECE 22.06\nFecho: Duplo D"} className="mt-2 h-32 w-full rounded-xl border border-line p-3 text-sm"/>
          <span className="mt-1 block font-normal text-muted">Uma especificação por linha no formato Nome: valor.</span>
        </label>
        <div className="md:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <b className="text-sm">Estoque e variações</b>
              <p className="mt-1 text-xs text-muted">
                {mode === "none"
                  ? "Esta categoria não usa tamanho. Cadastre apenas o estoque total do item."
                  : `Cada ${optionLabel.toLowerCase()} possui SKU e estoque próprios.`}
              </p>
            </div>
            {mode !== "none" && (
              <button
                type="button"
                onClick={() =>
                  setVariants((current) => [
                    ...current,
                    blankVariant(
                      baseSkuValue(product),
                      String(product.color || ""),
                    ),
                  ])
                }
                className={`${button} border border-line`}
              >
                <Plus size={15} />
                Adicionar
              </button>
            )}
          </div>
          <div className="mt-4 grid gap-3">
            {(mode === "none"
              ? variants.length
                ? variants
                : [{ ...blankVariant(), value: "Único" }]
              : variants
            ).map((variant, index) => (
              <div
                className={`grid gap-3 rounded-xl border border-line p-3 ${mode === "none" ? "sm:grid-cols-[1fr_140px]" : "sm:grid-cols-[1fr_1fr_120px_auto]"}`}
                key={variant.id || index}
              >
                {mode !== "none" && (
                  <label className="text-xs font-semibold">
                    {optionLabel}
                    <input
                      value={variant.value}
                      onChange={(e) =>
                        updateVariant(index, "value", e.target.value)
                      }
                      required
                      className={input}
                      placeholder={
                        mode === "size" ? "Ex.: 58 / M" : "Ex.: Bivolt"
                      }
                    />
                  </label>
                )}
                <label className="text-xs font-semibold">
                  SKU
                  <input
                    value={
                      variant.sku ||
                      `${String(product.sku || "SKU")}-${index + 1}`
                    }
                    onChange={(e) =>
                      updateVariant(index, "sku", e.target.value)
                    }
                    required
                    className={input}
                  />
                </label>
                <label className="text-xs font-semibold">
                  Estoque
                  <input
                    type="number"
                    min="0"
                    value={variant.stock}
                    onChange={(e) =>
                      updateVariant(index, "stock", e.target.value)
                    }
                    required
                    className={input}
                  />
                </label>
                {mode !== "none" && (
                  <button
                    type="button"
                    aria-label="Remover variação"
                    onClick={() =>
                      setVariants((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                    className="mt-6 grid size-11 place-items-center rounded-xl border border-line text-danger"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <aside className="grid h-fit gap-4">
        <div className="card p-5">
          <b>Publicação</b>
          <label className="mt-4 block text-xs font-semibold">
            Status
            <select
              name="publication_status"
              defaultValue={product.publication_status || "active"}
              className={input}
            >
              <option value="draft">Rascunho</option>
              <option value="active">Ativo</option>
              <option value="archived">Arquivado</option>
            </select>
          </label>
          {[
            ["featured", "Produto em destaque"],
            ["is_new", "Marcar como lançamento"],
            ["solar_visor", "Viseira solar"],
            ["pinlock_ready", "Preparado para Pinlock"],
          ].map(([name, title]) => (
            <label className="mt-4 flex items-center gap-3 text-sm" key={name}>
              <input
                name={name}
                type="checkbox"
                defaultChecked={Boolean(product[name] ?? name === "active")}
                className="size-4 accent-accent"
              />
              {title}
            </label>
          ))}
          <button
            disabled={busy}
            className={`${button} mt-6 w-full bg-accent text-white`}
          >
            {busy ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Check size={16} />
            )}
            Salvar produto
          </button>
          {message && <p className="mt-3 text-xs text-muted">{message}</p>}
        </div>
        <div className="rounded-2xl border border-line bg-white p-4 text-xs leading-5 text-muted">
          <b className="text-ink">Regra comercial</b>
          <p className="mt-2">
            Use “Preço anterior” para criar uma oferta. As datas são opcionais.
            Para lançamentos, marque a opção e defina o período desejado.
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4 text-xs leading-5 text-muted">
          <b className="text-ink">Regra da categoria</b>
          <p className="mt-2">
            {!category
              ? "Selecione uma categoria."
              : mode === "none"
                ? "Sem tamanho ou opções de escolha."
                : mode === "size"
                  ? "Usa tamanhos e exibe o guia de medidas na loja."
                  : `Usa ${optionLabel.toLowerCase()} como opção de compra.`}
          </p>
        </div>
        <Link
          href="/admin/produtos"
          className={`${button} border border-line bg-white`}
        >
          <ChevronLeft size={16} />
          Voltar aos produtos
        </Link>
      </aside>
    </form>
  );
}
function baseSkuValue(product: Item) {
  return String(product.sku || "");
}
function toDateTimeLocal(value?: string) {
  return value ? value.replace(" ", "T").slice(0, 16) : "";
}
function Field({
  name,
  label,
  value,
  type = "text",
  step,
  required,
  wide,
}: {
  name: string;
  label: string;
  value?: any;
  type?: string;
  step?: string;
  required?: boolean;
  wide?: boolean;
}) {
  if (name === "image_url")
    return (
      <ImageUploadField
        name={name}
        label={label}
        defaultValue={value ?? ""}
        required={required}
        wide={wide}
      />
    );
  return (
    <label className={`text-xs font-semibold ${wide ? "md:col-span-2" : ""}`}>
      {label}
      <input
        name={name}
        type={type}
        step={step}
        required={required}
        defaultValue={value ?? ""}
        className={input}
      />
    </label>
  );
}
function Select({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value?: any;
  options: Item[];
}) {
  return (
    <label className="text-xs font-semibold">
      {label}
      <select name={name} defaultValue={value} required className={input}>
        <option value="">Selecione</option>
        {options.map((item) => (
          <option value={item.id} key={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </label>
  );
}
