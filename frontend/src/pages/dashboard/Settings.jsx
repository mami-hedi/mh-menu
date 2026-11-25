import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, Button, Card, Field, Input } from '../../components/ui.jsx';
import { PasswordInput, passwordRules } from '../auth/AuthShell.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useAuth } from '../../store/AuthContext.jsx';
import { api, parseError, tokenStore } from '../../services/api.js';
import { usePageMeta } from '../../hooks/usePageMeta.js';

const ROLE_LABELS = { owner: 'Propriétaire', manager: 'Manager', editor: 'Éditeur' };

function ProfileForm() {
  const toast = useToast();
  const { user, refresh } = useAuth();
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, setError, reset, formState: { errors, isSubmitting, isDirty } } = useForm({ defaultValues: { name: user.name, phone: user.phone ?? '' } });

  const onSubmit = async (v) => {
    setServerError('');
    try {
      await api.patch('/auth/me', { name: v.name.trim(), phone: v.phone.trim() });
      await refresh();
      reset({ name: v.name.trim(), phone: v.phone.trim() });
      toast.success('Profil mis à jour.');
    } catch (err) {
      const p = parseError(err);
      for (const [k, msg] of Object.entries(p.fields ?? {})) setError(k, { message: msg });
      setServerError(p.message);
    }
  };

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="font-bold">Mon profil</h2>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-4 space-y-4">
        {serverError && <Alert>{serverError}</Alert>}
        <Field label="Email" htmlFor="s-email" hint="L'email de connexion ne peut pas être modifié ici.">
          <Input id="s-email" value={user.email} readOnly disabled />
        </Field>
        <div className="text-sm text-navy-500">Rôle : <strong className="text-navy-800">{ROLE_LABELS[user.role] ?? user.role}</strong></div>
        <Field label="Nom" htmlFor="s-name" error={errors.name?.message}>
          <Input id="s-name" invalid={!!errors.name} {...register('name', { required: 'Nom requis.', minLength: { value: 2, message: 'Au moins 2 caractères.' }, maxLength: { value: 120, message: '120 caractères maximum.' } })} />
        </Field>
        <Field label="Téléphone" htmlFor="s-phone" error={errors.phone?.message}>
          <Input id="s-phone" type="tel" invalid={!!errors.phone} {...register('phone', { pattern: { value: /^\+?[0-9 .-]{8,20}$/, message: 'Numéro invalide.' } })} />
        </Field>
        <Button type="submit" loading={isSubmitting} disabled={!isDirty}>Enregistrer</Button>
      </form>
    </Card>
  );
}

function PasswordForm() {
  const toast = useToast();
  const { refresh } = useAuth();
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, setError, reset, getValues, formState: { errors, isSubmitting } } = useForm({ defaultValues: { currentPassword: '', password: '', confirmPassword: '' } });

  const onSubmit = async (v) => {
    setServerError('');
    try {
      const { data } = await api.post('/auth/change-password', v);
      tokenStore.set(data.token); // les autres sessions sont déconnectées ; celle-ci reste valide
      await refresh();
      reset();
      toast.success('Mot de passe modifié. Vos autres sessions ont été déconnectées.');
    } catch (err) {
      const p = parseError(err);
      let applied = false;
      for (const [k, msg] of Object.entries(p.fields ?? {})) { setError(k, { message: msg }); applied = true; }
      if (!applied || p.status === 429) setServerError(p.message);
    }
  };

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="font-bold">Changer le mot de passe</h2>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-4 space-y-4">
        {serverError && <Alert>{serverError}</Alert>}
        <Field label="Mot de passe actuel" htmlFor="currentPassword" error={errors.currentPassword?.message}>
          <PasswordInput id="currentPassword" autoComplete="current-password" invalid={!!errors.currentPassword} {...register('currentPassword', { required: 'Mot de passe actuel requis.' })} />
        </Field>
        <Field label="Nouveau mot de passe" htmlFor="password" error={errors.password?.message} hint="10 caractères minimum, avec une lettre et un chiffre.">
          <PasswordInput id="password" autoComplete="new-password" invalid={!!errors.password} {...register('password', passwordRules)} />
        </Field>
        <Field label="Confirmer le nouveau mot de passe" htmlFor="confirmPassword" error={errors.confirmPassword?.message}>
          <PasswordInput id="confirmPassword" autoComplete="new-password" invalid={!!errors.confirmPassword}
            {...register('confirmPassword', { required: 'Confirmation requise.', validate: (v) => v === getValues('password') || 'Les mots de passe ne correspondent pas.' })} />
        </Field>
        <Button type="submit" loading={isSubmitting}>Modifier le mot de passe</Button>
      </form>
    </Card>
  );
}

export default function Settings() {
  usePageMeta('Paramètres – MH Menu');
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Paramètres</h1>
        <p className="mt-1 text-navy-500">Votre profil et la sécurité de votre compte.</p>
      </div>
      <ProfileForm />
      <PasswordForm />
    </div>
  );
}
