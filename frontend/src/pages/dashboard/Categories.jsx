import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ArrowDown, ArrowUp, LayoutGrid, Pencil, Plus, Trash2 } from 'lucide-react';
import { Alert, Button, Card, Field, Input, Spinner } from '../../components/ui.jsx';
import { ConfirmDialog, Modal } from '../../components/Modal.jsx';
import ImageUploader from '../../components/ImageUploader.jsx';
import Toggle from '../../components/Toggle.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useCanWrite, WriteBlockedNotice } from '../../components/WriteGuard.jsx';
import { useAuth } from '../../store/AuthContext.jsx';
import { api, parseError } from '../../services/api.js';
import { usePageMeta } from '../../hooks/usePageMeta.js';
import { optimizeImage } from '../../lib/format.js';

const sortByOrder = (list) => [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);

function CategoryForm({ category, onClose, onSaved }) {
  const toast = useToast();
  const canWrite = useCanWrite();
  const [current, setCurrent] = useState(category); // la catégorie reste à jour après un envoi d'image
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { name: category?.name ?? '', description: category?.description ?? '', isActive: category?.isActive ?? true },
  });
  const [isActive, setIsActive] = useState(category?.isActive ?? true);

  const onSubmit = async (v) => {
    setServerError('');
    try {
      const body = { name: v.name.trim(), description: v.description.trim(), isActive };
      const { data } = current ? await api.patch(`/restaurant/categories/${current.id}`, body) : await api.post('/restaurant/categories', body);
      const created = !current;
      toast.success(created ? 'Catégorie créée. Vous pouvez maintenant ajouter une image.' : 'Catégorie modifiée.');
      setCurrent(data); // après une création, le formulaire passe en mode édition (image possible)
      onSaved(data, created);
    } catch (err) {
      const p = parseError(err);
      if (p.status === 409) setError('name', { message: p.message });
      else setServerError(p.message);
    }
  };

  const upload = async (file) => {
    const f = new FormData();
    f.append('image', file);
    try {
      const { data } = await api.put(`/restaurant/categories/${current.id}/image`, f);
      setCurrent(data); onSaved(data, false, true);
    } catch (e) { throw new Error(parseError(e).message); }
  };
  const removeImage = async () => {
    try {
      const { data } = await api.delete(`/restaurant/categories/${current.id}/image`);
      setCurrent(data); onSaved(data, false, true);
    } catch (e) { throw new Error(parseError(e).message); }
  };

  return (
    <Modal title={current ? 'Modifier la catégorie' : 'Nouvelle catégorie'} onClose={onClose} size="sm">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-col">
        <div className="space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          {serverError && <Alert>{serverError}</Alert>}
          <Field label="Nom" htmlFor="cat-name" error={errors.name?.message}>
            <Input id="cat-name" data-autofocus placeholder="Pizzas" invalid={!!errors.name}
              {...register('name', { required: 'Nom requis.', maxLength: { value: 100, message: '100 caractères maximum.' }, validate: (v) => v.trim() !== '' || 'Nom requis.' })} />
          </Field>
          <Field label="Description (facultatif)" htmlFor="cat-desc" error={errors.description?.message}>
            <Input id="cat-desc" {...register('description', { maxLength: { value: 255, message: '255 caractères maximum.' } })} />
          </Field>
          <div className="flex items-center justify-between rounded-xl border border-navy-100 px-4 py-3">
            <div><div className="text-sm font-semibold">Catégorie active</div><div className="text-xs text-navy-500">Une catégorie inactive est masquée du menu.</div></div>
            <Toggle checked={isActive} onChange={setIsActive} label="Catégorie active" />
          </div>
          {current ? (
            <ImageUploader label="Image de la catégorie" url={current.imageUrl} onUpload={upload} onRemove={removeImage} disabled={!canWrite} />
          ) : (
            <p className="rounded-xl bg-navy-50 px-4 py-3 text-xs text-navy-500">Vous pourrez ajouter une image dès que la catégorie sera créée.</p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-navy-100 px-5 py-4 sm:px-6">
          <Button type="button" variant="secondary" onClick={onClose}>Fermer</Button>
          <Button type="submit" loading={isSubmitting} disabled={!canWrite}>{current ? 'Enregistrer' : 'Créer'}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function Categories() {
  usePageMeta('Catégories – MH Menu');
  const toast = useToast();
  const { user } = useAuth();
  const canWrite = useCanWrite();
  const canDelete = user.role === 'owner' || user.role === 'manager';
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(undefined); // undefined = fermé, null = création, objet = édition
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError('');
    api.get('/restaurant/categories').then((r) => setItems(r.data)).catch((e) => setError(parseError(e).message));
  }, []);
  useEffect(load, [load]);

  const replace = (c) => setItems((cur) => sortByOrder(cur.some((x) => x.id === c.id) ? cur.map((x) => (x.id === c.id ? { ...c, productCount: x.productCount } : x)) : [...cur, c]));

  const toggleActive = async (c, isActive) => {
    const prev = items;
    setItems((cur) => cur.map((x) => (x.id === c.id ? { ...x, isActive } : x)));
    try { await api.patch(`/restaurant/categories/${c.id}`, { isActive }); }
    catch (e) { setItems(prev); toast.error(parseError(e).message); }
  };

  const move = async (index, delta) => {
    const next = [...items];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    const prev = items;
    setItems(next);
    try {
      const { data } = await api.put('/restaurant/categories/reorder', { ids: next.map((c) => c.id) });
      setItems(data);
    } catch (e) { setItems(prev); toast.error(parseError(e).message); }
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await api.delete(`/restaurant/categories/${deleting.id}`);
      setItems((cur) => cur.filter((c) => c.id !== deleting.id));
      toast.success('Catégorie supprimée.');
      setDeleting(null);
    } catch (e) { toast.error(parseError(e).message); setDeleting(null); }
    finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Catégories</h1>
          <p className="mt-1 text-navy-500">Organisez votre carte : entrées, pizzas, boissons…</p>
        </div>
        <Button onClick={() => setEditing(null)} disabled={!canWrite}><Plus className="h-4 w-4" aria-hidden="true" /> Ajouter une catégorie</Button>
      </div>

      <WriteBlockedNotice />
      {error && <Alert>{error} <button type="button" className="font-bold underline" onClick={load}>Réessayer</button></Alert>}
      {!items && !error && <Spinner />}

      {items && items.length === 0 && (
        <Card className="p-10 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-navy-50 text-navy-500"><LayoutGrid className="h-7 w-7" aria-hidden="true" /></span>
          <h2 className="mt-4 text-lg font-bold">Aucune catégorie pour le moment</h2>
          <p className="mx-auto mt-1 max-w-sm text-navy-500">Créez votre première catégorie, puis ajoutez-y vos produits.</p>
        </Card>
      )}

      {items && items.length > 0 && (
        <Card>
          <ul className="divide-y divide-navy-100">
            {items.map((c, i) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 p-4 sm:flex-nowrap">
                <div className="flex shrink-0 flex-col">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0 || !canWrite} className="rounded p-1 text-navy-500 hover:bg-navy-50 hover:text-navy-700 disabled:opacity-30" aria-label={`Monter ${c.name}`}><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1 || !canWrite} className="rounded p-1 text-navy-500 hover:bg-navy-50 hover:text-navy-700 disabled:opacity-30" aria-label={`Descendre ${c.name}`}><ArrowDown className="h-4 w-4" /></button>
                </div>
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-navy-50">
                  {c.imageUrl ? <img src={optimizeImage(c.imageUrl, 160)} alt="" className="h-full w-full object-cover" loading="lazy" /> : <div className="grid h-full w-full place-items-center text-navy-300"><LayoutGrid className="h-5 w-5" aria-hidden="true" /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`truncate font-bold ${c.isActive ? '' : 'text-navy-500'}`}>{c.name}</div>
                  <div className="truncate text-sm text-navy-500">{c.productCount} produit{c.productCount > 1 ? 's' : ''}{c.description ? ` · ${c.description}` : ''}</div>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <Toggle checked={c.isActive} onChange={(v) => toggleActive(c, v)} label={`Catégorie ${c.name} active`} disabled={!canWrite} size="sm" />
                  <button type="button" onClick={() => setEditing(c)} className="rounded-lg p-2 text-navy-500 hover:bg-navy-50" aria-label={`Modifier ${c.name}`}><Pencil className="h-4 w-4" /></button>
                  {canDelete && <button type="button" onClick={() => setDeleting(c)} disabled={!canWrite} className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:opacity-40" aria-label={`Supprimer ${c.name}`}><Trash2 className="h-4 w-4" /></button>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {editing !== undefined && (
        <CategoryForm
          category={editing}
          onClose={() => setEditing(undefined)}
          onSaved={(c, created, imageOnly) => { replace(c); if (!imageOnly && !created) setEditing(undefined); }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Supprimer la catégorie ?"
          message={deleting.productCount > 0
            ? `« ${deleting.name} » contient ${deleting.productCount} produit${deleting.productCount > 1 ? 's' : ''}. Ils seront supprimés définitivement avec leurs photos.`
            : `« ${deleting.name} » sera supprimée définitivement.`}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
          loading={busy}
        />
      )}
    </div>
  );
}
