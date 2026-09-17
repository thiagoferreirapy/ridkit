import { z } from "zod";
const imageLocation=z.union([z.string().url(),z.string().regex(/^\/uploads\/[a-zA-Z0-9._-]+$/,"Imagem inválida")]);

export const productSchema = z.object({
  brand_id: z.coerce.number().int().positive(), category_id: z.coerce.number().int().positive(),
  name: z.string().trim().min(3).max(140), slug: z.string().trim().optional(), sku: z.string().trim().min(3).max(40),
  description: z.string().trim().min(10), price_cents: z.coerce.number().int().nonnegative(),
  compare_at_cents: z.coerce.number().int().nonnegative().nullable().optional(), cost_cents: z.coerce.number().int().nonnegative().default(0),
  color: z.string().trim().min(2), finish: z.string().trim().optional().nullable(), shell_material: z.string().trim().optional().nullable(),
  weight_grams: z.coerce.number().int().positive().optional().nullable(), solar_visor: z.coerce.number().int().min(0).max(1).default(0),
  pinlock_ready: z.coerce.number().int().min(0).max(1).default(0), featured: z.coerce.number().int().min(0).max(1).default(0),
  is_new: z.coerce.number().int().min(0).max(1).default(0), launch_starts_at: z.string().optional().nullable(), launch_ends_at: z.string().optional().nullable(),
  offer_starts_at: z.string().optional().nullable(), offer_ends_at: z.string().optional().nullable(),
  publication_status: z.enum(["draft","active","archived"]).default("active"), seo_title:z.string().trim().max(70).optional().nullable(),
  seo_description:z.string().trim().max(170).optional().nullable(),seo_image_url:imageLocation.optional().nullable(),
  active: z.coerce.number().int().min(0).max(1).default(1),
  images: z.array(z.object({ url: imageLocation, alt: z.string().min(2), photographer: z.string().optional(), photographer_url: z.string().url().optional() })).default([]),
  variants: z.array(z.object({ sku: z.string().min(3), size: z.string().min(1), color: z.string().min(2), stock: z.coerce.number().int().nonnegative(), price_cents: z.coerce.number().int().nonnegative().nullable().optional() })).min(1),
});
export const productPatchSchema = productSchema.omit({ images: true, variants: true }).partial();
export const adminProductPatchSchema = productPatchSchema.extend({
  images: z.array(z.object({ id:z.coerce.number().int().positive().optional(),url:imageLocation,alt:z.string().min(2),photographer:z.string().optional().nullable(),photographer_url:z.string().url().optional().nullable() })).optional(),
  variants: z.array(z.object({ id:z.coerce.number().int().positive().optional(),sku:z.string().min(3),size:z.string().min(1),color:z.string().min(2),stock:z.coerce.number().int().nonnegative(),reserved_stock:z.coerce.number().int().nonnegative().default(0),price_cents:z.coerce.number().int().nonnegative().nullable().optional(),active:z.coerce.number().int().min(0).max(1).default(1) })).optional(),
});

export const orderSchema = z.object({
  idempotency_key: z.string().uuid().optional(),
  coupon_code: z.string().trim().optional(),
  payment_method: z.literal("pix"), shipping_method: z.enum(["Econômica","Expressa","Retirada"]),
  shipping_address: z.object({ zip_code:z.string().min(8), street:z.string().min(2), number:z.string().min(1), complement:z.string().optional(), district:z.string().min(2), city:z.string().min(2), state:z.string().length(2) }),
  items: z.array(z.object({ variant_id:z.coerce.number().int().positive(), quantity:z.coerce.number().int().min(1).max(10) })).min(1),
});

export const cartSchema = z.object({ session_id:z.string().min(6).max(120), customer_id:z.coerce.number().int().positive().nullable().optional(), variant_id:z.coerce.number().int().positive(), quantity:z.coerce.number().int().min(1).max(10).default(1) });
