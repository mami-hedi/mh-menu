import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Alert, Button, Field, Input } from '../../components/ui.jsx';
import { useAuth } from '../../store/AuthContext.jsx';
import { parseError } from '../../services/api.js';
import { usePageMeta } from '../../hooks/usePageMeta.js';
import { AuthShell, PasswordInput } from './AuthShell.jsx';

export default function Login() {
  usePageMeta('Connexion – MH Menu');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ defaultValues: { email: '', password: '' } });

  const onSubmit = async (values) => {
    setServerError('');
    try {
      const data = await login({ email: values.email.trim(), password: values.password });
      const from = location.state?.from;
      navigate(data.user.role === 'super_admin' ? '/admin' : from?.startsWith('/dashboard') ? from : '/dashboard', { replace: true });
    } catch (err) {
      setServerError(parseError(err).message);
    }
  };

  return (
    <AuthShell
      title="Connexion"
      subtitle="Accédez à votre espace restaurant."
      footer={<>Pas encore de compte ? <Link to="/inscription" className="font-semibold text-accent-700 hover:underline">Essai gratuit de 3 jours</Link></>}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        {serverError && <Alert>{serverError}</Alert>}
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" invalid={!!errors.email} aria-describedby={errors.email ? 'email-error' : undefined}
            {...register('email', { required: 'Email requis.', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Email invalide.' } })} />
        </Field>
        <Field label="Mot de passe" htmlFor="password" error={errors.password?.message}>
          <PasswordInput id="password" autoComplete="current-password" invalid={!!errors.password} aria-describedby={errors.password ? 'password-error' : undefined}
            {...register('password', { required: 'Mot de passe requis.' })} />
        </Field>
        <div className="text-right text-sm">
          <Link to="/mot-de-passe-oublie" className="font-semibold text-accent-700 hover:underline">Mot de passe oublié ?</Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Se connecter</Button>
      </form>
    </AuthShell>
  );
}
