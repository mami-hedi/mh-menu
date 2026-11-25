import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Alert, Button, Field, Input } from '../../components/ui.jsx';
import { api, parseError } from '../../services/api.js';
import { usePageMeta } from '../../hooks/usePageMeta.js';
import { AuthShell } from './AuthShell.jsx';

export default function ForgotPassword() {
  usePageMeta('Mot de passe oublié – MH Menu');
  const [done, setDone] = useState('');
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ defaultValues: { email: '' } });

  const onSubmit = async ({ email }) => {
    setServerError('');
    try {
      const { data } = await api.post('/auth/forgot-password', { email: email.trim() });
      setDone(data.message);
    } catch (err) {
      setServerError(parseError(err).message);
    }
  };

  return (
    <AuthShell
      title="Mot de passe oublié"
      subtitle="Saisissez votre email : nous vous envoyons un lien pour choisir un nouveau mot de passe."
      footer={<Link to="/connexion" className="font-semibold text-accent-700 hover:underline">← Retour à la connexion</Link>}
    >
      {done ? (
        <Alert tone="success">{done}</Alert>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          {serverError && <Alert>{serverError}</Alert>}
          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" invalid={!!errors.email}
              {...register('email', { required: 'Email requis.', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Email invalide.' } })} />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Envoyer le lien</Button>
        </form>
      )}
    </AuthShell>
  );
}
