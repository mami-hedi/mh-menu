import { z } from 'zod';
import { id, money, optionalText } from '../../utils/common.js';

const name = z.string().trim().min(1, 'Nom requis.').max(150, '150 caractères maximum.');

export const variantSchema = z.object({
  name: z.string().trim().min(1, 'Nom de la variante requis.').max(80),
  priceDelta: money,
  isDefault: z.boolean().optional(),
});

export const extraSchema = z.object({
  name: z.string().trim().min(1, 'Nom du supplément requis.').max(80),
  price: money,
  isRequired: z.boolean().optional(),
});

const base = {
  categoryId: id,
  name,
  description: optionalText(2000),
  price: money,
  promoPrice: money.nullish(),
  isPromo: z.boolean(),
  isAvailable: z.boolean(),
  isActive: z.boolean(),
  isPopular: z.boolean(),
  variants: z.array(variantSchema).max(10, '10 variantes maximum.'),
  extras: z.array(extraSchema).max(30, '30 suppléments maximum.'),
};

export const createProductSchema = z.object({
  ...base,
  description: base.description,
  isPromo: base.isPromo.optional().default(false),
  isAvailable: base.isAvailable.optional().default(true),
  isActive: base.isActive.optional().default(true),
  isPopular: base.isPopular.optional().default(false),
  variants: base.variants.optional().default([]),
  extras: base.extras.optional().default([]),
});

export const updateProductSchema = z.object({
  categoryId: base.categoryId.optional(),
  name: base.name.optional(),
  description: base.description.optional(),
  price: base.price.optional(),
  promoPrice: base.promoPrice.optional(),
  isPromo: base.isPromo.optional(),
  isAvailable: base.isAvailable.optional(),
  isActive: base.isActive.optional(),
  isPopular: base.isPopular.optional(),
  variants: base.variants.optional(),
  extras: base.extras.optional(),
});

export const listQuery = z.object({
  categoryId: id.optional(),
  q: z.string().trim().max(100).optional(),
  status: z.enum(['all', 'available', 'unavailable', 'inactive', 'promo']).default('all'),
});
