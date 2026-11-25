import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { KeyRound, Trash2, UserPlus } from 'lucide-react';
import { Alert, Button, Card, Field, Input, Spinner } from '../../components/ui.jsx';
import { ConfirmDialog, Modal } from '../../components/Modal.jsx';
import Toggle from '../../components/Toggle.jsx';
import { WriteBlockedNotice, useCanWrite } from '../../components/WriteGuard.jsx';
import { useToast } from '../../components/Toast.jsx';
import { api, parseError } from '../../services/api.js';
import { usePageMeta } from '../../hooks/usePageMeta.js';
import { formatDateTime } from '../../lib/format.js';

const ROLE_LABEL = { owner: 'Propriétaire', manager: 'Manager', editor: 'Éditeur' };
const ROLE_HELP = {
  manager: 'Gère le menu, les informations, les QR Codes et voit les statistiques.',
  editor: 'Modifie catégories, produits et promotions. Pas de paramètres ni de statistiques.',
};
const pwdRules = {
  required: 'Mot de passe requis.',
  minLength: { value: 10, message: '10 caractères minimum.' },
  maxLength: { value: 72, message: '72 caractères maximum.' },
  validate: (v) => (/[A-Za-z]/.test(v) && /\d/.test(v)) || 'Au moins une lettre et un chiffre.',
};

function AddMember({ onClose, onDone }) {
  const toast = useToast();
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, watch, setError, formState: { errors, isSubmitting } } = useForm({ defaultValues: { name: '', email: '', phone: '', role: 'editor', password: '' } });
  const role = watch('role');
  const submit = async (v) => {
    setServerError('');
    try {
      await api.post('/restaurant/team', { name: v.name.trim(), email: v.email.trim(), phone: v.phone.trim() || null, role: v.role, password: v.password });
      toast.success('Membre ajouté.'); onDone(); onClose();
    } catch (e) {
      const err = parseError(e);
      Object.entries(err.fields ?? {}).forEach(([k, m]) => { if (k in v) setError(k, { message: m }); });
      setServerError(err.message);
    }
  };
  return (
    <Modal title="Ajouter un membre" onClose={onClose} size="sm">
      <form onSubmit={handleSubmit(submit)} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          {serverError && <Alert>{serverError}</Alert>}
          <Field label="Nom" htmlFor="m-name" error={errors.name?.message}><Input id="m-name" autoComplete="off" invalid={!!errors.name} {...register('name', { validate: (v) => v.trim().length >= 2 || 'Nom requis.' })} /></Field>
          <Field label="Email" htmlFor="m-email" error={errors.email?.message}><Input id="m-email" type="email" autoComplete="off" invalid={!!errors.email} {...register('email', { required: 'Email requis.' })} /></Field>
          <Field label="Téléphone (facultatif)" htmlFor="m-phone" error={errors.phone?.message}><Input id="m-phone" type="tel" inputMode="tel" autoComplete="off" {...register('phone')} /></Field>
          <Field label="Rôle" htmlFor="m-role" hint={ROLE_HELP[role]}>
            <select id="m-role" className="w-full rounded-xl border border-navy-200 bg-white px-3 py-2.5 text-sm" {...register('role')}>
              <option value="editor">Éditeur</option><option value="manager">Manager</option>
            </select>
          </Field>
          <Field label="Mot de passe provisoire" htmlFor="m-pwd" error={errors.password?.message} hint="10 caractères minimum, avec lettre et chiffre. Communiquez-le au membre : il pourra le changer dans Paramètres.">
            <Input id="m-pwd" type="text" autoComplete="new-password" invalid={!!errors.password} {...register('password', pwdRules)} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 border-t border-navy-100 px-5 py-4 sm:px-6"><Button variant="secondary" type="button" onClick={onClose}>Annuler</Button><Button type="submit" loading={isSubmitting}>Ajouter</Button></div>
      </form>
    </Modal>
  );
}

function ResetPassword({ member, onClose }) {
  const toast = useToast();
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ defaultValues: { password: '' } });
  const submit = async (v) => {
    setServerError('');
    try { await api.post(`/restaurant/team/${member.id}/password`, { password: v.password }); toast.success('Mot de passe réinitialisé. Ses sessions ont été fermées.'); onClose(); }
    catch (e) { setServerError(parseError(e).message); }
  };
  return (
    <Modal title={`Nouveau mot de passe — ${member.name}`} onClose={onClose} size="sm">
      <form onSubmit={handleSubmit(submit)} noValidate>
        <div className="space-y-4 px-5 py-5 sm:px-6">
          {serverError && <Alert>{serverError}</Alert>}
          <Field label="Nouveau mot de passe" htmlFor="r-pwd" error={errors.password?.message} hint="Le membre sera déconnecté de tous ses appareils.">
            <Input id="r-pwd" type="text" autoComplete="new-password" invalid={!!errors.password} {...register('password', pwdRules)} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 border-t border-navy-100 px-5 py-4 sm:px-6"><Button variant="secondary" type="button" onClick={onClose}>Annuler</Button><Button type="submit" loading={isSubmitting}>Enregistrer</Button></div>
      </form>
    </Modal>
  );
}

export default function Team() {
  usePageMeta('Utilisateurs – MH Menu');
  const toast = useToast();
  const canWrite = useCanWrite();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.get('/restaurant/team').then((r) => setData(r.data)).catch((e) => setError(parseError(e).message)), []);
  useEffect(() => { load(); }, [load]);

  const patch = async (m, body, okMsg) => {
    try { await api.patch(`/restaurant/team/${m.id}`, body); toast.success(okMsg); load(); }
    catch (e) { toast.error(parseError(e).message); }
  };
  const remove = async () => {
    setBusy(true);
    try { await api.delete(`/restaurant/team/${removing.id}`); toast.success('Membre retiré.'); setRemoving(null); load(); }
    catch (e) { toast.error(parseError(e).message); }
    finally { setBusy(false); }
  };

  const full = data && data.members.length >= data.max;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-extrabold tracking-tight">Utilisateurs</h1><p className="mt-1 text-navy-500">Donnez accès à votre équipe avec des droits adaptés.</p></div>
        <Button onClick={() => setAdding(true)} disabled={!canWrite || full}><UserPlus className="h-4 w-4" aria-hidden="true" /> Ajouter un membre</Button>
      </div>
      <WriteBlockedNotice />
      {full && <Alert tone="info">Limite de {data.max} membres atteinte.</Alert>}
      {error && <Alert>{error}</Alert>}
      {!data && !error && <Spinner />}
      {data && (
        <ul className="space-y-3">
          {data.members.map((m) => {
            const locked = m.role === 'owner' || m.isMe;
            return (
              <li key={m.id}>
                <Card className={`p-4 sm:p-5 ${m.isActive ? '' : 'opacity-70'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-bold">{m.name}</span>
                        <span className="rounded-full bg-navy-50 px-2.5 py-0.5 text-xs font-bold text-navy-700">{ROLE_LABEL[m.role]}</span>
                        {m.isMe && <span className="rounded-full bg-accent-50 px-2.5 py-0.5 text-xs font-bold text-accent-700">Vous</span>}
                        {!m.isActive && <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800">Désactivé</span>}
                      </div>
                      <p className="mt-0.5 break-all text-sm text-navy-600">{m.email}</p>
                      <p className="mt-0.5 text-xs text-navy-500">{m.lastLoginAt ? `Dernière connexion : ${formatDateTime(m.lastLoginAt)}` : 'Jamais connecté'}</p>
                    </div>
                    {!locked && (
                      <label className="flex shrink-0 items-center gap-2 text-sm font-medium text-navy-600">
                        <Toggle checked={m.isActive} disabled={!canWrite} label={`${m.name} actif`} onChange={(v) => patch(m, { isActive: v }, v ? 'Compte réactivé.' : 'Compte désactivé.')} /> Actif
                      </label>
                    )}
                  </div>
                  {!locked && (
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-navy-100 pt-3">
                      <label className="sr-only" htmlFor={`role-${m.id}`}>Rôle de {m.name}</label>
                      <select id={`role-${m.id}`} value={m.role} disabled={!canWrite} onChange={(e) => patch(m, { role: e.target.value }, 'Rôle modifié.')}
                        className="rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm disabled:opacity-60">
                        <option value="manager">Manager</option><option value="editor">Éditeur</option>
                      </select>
                      <Button variant="secondary" size="sm" disabled={!canWrite} onClick={() => setResetting(m)}><KeyRound className="h-4 w-4" aria-hidden="true" /> Mot de passe</Button>
                      <Button variant="ghost" size="sm" disabled={!canWrite} onClick={() => setRemoving(m)} className="ml-auto text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" aria-hidden="true" /> Retirer</Button>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      {adding && <AddMember onClose={() => setAdding(false)} onDone={load} />}
      {resetting && <ResetPassword member={resetting} onClose={() => setResetting(null)} />}
      {removing && <ConfirmDialog title="Retirer ce membre ?" message={`${removing.name} ne pourra plus se connecter. Cette action est définitive.`} confirmLabel="Retirer" onConfirm={remove} onClose={() => setRemoving(null)} loading={busy} />}
    </div>
  );
}
