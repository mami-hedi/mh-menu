import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Alert, Button, ButtonLink, Field } from '../../components/ui.jsx';
import { api, parseError } from '../../services/api.js';
import { usePageMeta } from '../../hooks/usePageMeta.js';
import { applyServerErrors, AuthShell, PasswordInput, passwordRules } from './AuthShell.jsx';

export default function ResetPassword() {
  usePageMeta('Nouveau mot de passe – MH Menu');
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, setError, getValues, formState: { errors, isSubmitting } } = useForm({ defaultValues: { password: '', confirmPassword: '' } });

  const onSubmit = async (v) => {
    setServerError('');
    try {
      await api.post('/auth/reset-password', { token, password: v.password, confirmPassword: v.confirmPassword });
      setDone(true);
    } catch (err) {
      const parsed = parseError(err);
      if (!applyServerErrors(parsed, setError, ['password', 'confirmPassword'])) setServerError(parsed.fields.token || parsed.message);
    }
  };

  const invalidLink = !/^[a-f0-9]{64}$/.test(token);

  return (
    <AuthShell title="Nouveau mot de passe" subtitle="Choisissez un nouveau mot de passe pour votre compte.">
      {done ? (
        <div className="space-y-5">
          <Alert tone="success">Mot de passe modifié. Vous pouvez maintenant vous connecter.</Alert>
          <ButtonLink to="/connexion" size="lg" className="w-full">Se connecter</ButtonLink>
        </div>
      ) : invalidLink ? (
        <div className="space-y-5">
          <Alert>Ce lien est invalide. Refaites une demande de réinitialisation.</Alert>
          <Link to="/mot-de-passe-oublie" className="font-semibold text-accent-700 hover:underline">Demander un nouveau lien</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          {serverError && (
            <Alert>{serverError} <Link to="/mot-de-passe-oublie" className="font-semibold underline">Demander un nouveau lien</Link></Alert>
          )}
          <Field label="Nouveau mot de passe" htmlFor="password" error={errors.password?.message} hint="10 caractères minimum, avec une lettre et un chiffre.">
            <PasswordInput id="password" autoComplete="new-password" invalid={!!errors.password} {...register('password', passwordRules)} />
          </Field>
          <Field label="Confirmer le mot de passe" htmlFor="confirmPassword" error={errors.confirmPassword?.message}>
            <PasswordInput id="confirmPassword" autoComplete="new-password" invalid={!!errors.confirmPassword}
              {...register('confirmPassword', { required: 'Confirmation requise.', validate: (v) => v === getValues('password') || 'Les mots de passe ne correspondent pas.' })} />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Enregistrer</Button>
        </form>
      )}
    </AuthShell>
  );
}
