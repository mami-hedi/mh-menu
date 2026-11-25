import { z } from 'zod';

const email = z.string().trim().toLowerCase().max(190, 'Email trop long.').email('Email invalide.');

// 10 caractères minimum, au moins une lettre et un chiffre ; plafond à 72 octets (limite de bcrypt)
const password = z
  .string()
  .min(10, 'Le mot de passe doit contenir au moins 10 caractères.')
  .max(72, 'Le mot de passe ne doit pas dépasser 72 caractères.')
  .regex(/[A-Za-z]/, 'Le mot de passe doit contenir au moins une lettre.')
  .regex(/\d/, 'Le mot de passe doit contenir au moins un chiffre.');

// Numéros tunisiens ou internationaux : chiffres, espaces, +, tirets
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 .-]{8,20}$/, 'Numéro de téléphone invalide.');

export const registerSchema = z
  .object({
    restaurantName: z.string().trim().min(2, 'Nom du restaurant requis.').max(120),
    ownerName: z.string().trim().min(2, 'Nom du propriétaire requis.').max(120),
    email,
    phone,
    password,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Les mots de passe ne correspondent pas.',
  });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Mot de passe requis.').max(200),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    token: z.string().regex(/^[a-f0-9]{64}$/, 'Lien invalide.'),
    password,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Les mots de passe ne correspondent pas.',
  });

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Nom requis.').max(120),
  phone: phone.or(z.literal('')).transform((v) => v || null).nullish(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Mot de passe actuel requis.').max(200),
    password,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'Les mots de passe ne correspondent pas.' });
