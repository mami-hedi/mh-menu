import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Alert, Button, Field, Input } from '../../components/ui.jsx';
import { useAuth } from '../../store/AuthContext.jsx';
import { parseError } from '../../services/api.js';
import { usePageMeta } from '../../hooks/usePageMeta.js';
import { applyServerErrors, AuthShell, PasswordInput, passwordRules } from './AuthShell.jsx';

const FIELDS = ['restaurantName', 'ownerName', 'email', 'phone', 'password', 'confirmPassword'];

export default function Register() {
  usePageMeta('Créer mon menu gratuitement – MH Menu');
  const { register: signUp } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, setError, getValues, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { restaurantName: '', ownerName: '', email: '', phone: '', password: '', confirmPassword: '' },
  });

  const onSubmit = async (v) => {
    setServerError('');
    try {
      await signUp({
        restaurantName: v.restaurantName.trim(),
        ownerName: v.ownerName.trim(),
        email: v.email.trim(),
        phone: v.phone.trim(),
        password: v.password,
        confirmPassword: v.confirmPassword,
      });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const parsed = parseError(err);
      if (!applyServerErrors(parsed, setError, FIELDS)) setServerError(parsed.message);
      else if (parsed.status !== 400) setServerError(parsed.message);
    }
  };

  const f = (name) => ({ id: name, invalid: !!errors[name], 'aria-describedby': errors[name] ? `${name}-error` : undefined });

  return (
    <AuthShell
      title="Créez votre menu digital"
      subtitle="3 jours d’essai gratuit, sans carte bancaire."
      footer={<>Déjà un compte ? <Link to="/connexion" className="font-semibold text-accent-700 hover:underline">Se connecter</Link></>}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {serverError && <Alert>{serverError}</Alert>}
        <Field label="Nom du restaurant" htmlFor="restaurantName" error={errors.restaurantName?.message}>
          <Input {...f('restaurantName')} autoComplete="organization" placeholder="Pizzeria Bella"
            {...register('restaurantName', { required: 'Nom du restaurant requis.', minLength: { value: 2, message: 'Au moins 2 caractères.' }, maxLength: { value: 120, message: '120 caractères maximum.' } })} />
        </Field>
        <Field label="Nom du propriétaire" htmlFor="ownerName" error={errors.ownerName?.message}>
          <Input {...f('ownerName')} autoComplete="name"
            {...register('ownerName', { required: 'Nom du propriétaire requis.', minLength: { value: 2, message: 'Au moins 2 caractères.' } })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <Input {...f('email')} type="email" autoComplete="email"
              {...register('email', { required: 'Email requis.', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Email invalide.' } })} />
          </Field>
          <Field label="Téléphone" htmlFor="phone" error={errors.phone?.message}>
            <Input {...f('phone')} type="tel" autoComplete="tel" placeholder="+216 22 123 456"
              {...register('phone', { required: 'Téléphone requis.', pattern: { value: /^\+?[0-9 .-]{8,20}$/, message: 'Numéro invalide.' } })} />
          </Field>
        </div>
        <Field label="Mot de passe" htmlFor="password" error={errors.password?.message} hint="10 caractères minimum, avec une lettre et un chiffre.">
          <PasswordInput {...f('password')} autoComplete="new-password" {...register('password', passwordRules)} />
        </Field>
        <Field label="Confirmer le mot de passe" htmlFor="confirmPassword" error={errors.confirmPassword?.message}>
          <PasswordInput {...f('confirmPassword')} autoComplete="new-password"
            {...register('confirmPassword', { required: 'Confirmation requise.', validate: (v) => v === getValues('password') || 'Les mots de passe ne correspondent pas.' })} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Créer mon compte</Button>
        <p className="text-center text-xs text-navy-500">
          En créant un compte, vous acceptez les <Link to="/conditions-generales" className="underline">conditions générales</Link> et la <Link to="/politique-de-confidentialite" className="underline">politique de confidentialité</Link>.
        </p>
      </form>
    </AuthShell>
  );
}
