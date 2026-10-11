'use client';

import { type FormEvent, useState, useTransition } from 'react';
import { Truck, X } from 'lucide-react';
import { saveDeliveryPhone } from '@/app/delivery-settings-actions';

export default function DeliverySettingsButton({ phone }: { phone: string | null }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const data = new FormData(event.currentTarget);
    startTransition(() => {
      void saveDeliveryPhone(data).then((result) => {
        if (result.ok) setOpen(false);
        else setError(result.error);
      }).catch(() => setError('Enregistrement impossible. Réessayez.'));
    });
  }

  return <>
    <button type="button" onClick={() => { setError(''); setOpen(true); }} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" title="Configurer le numéro WhatsApp du service livraison"><Truck size={16} /> Livraison</button>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="delivery-settings-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800">
        <div className="mb-4 flex items-center justify-between"><h2 id="delivery-settings-title" className="text-lg font-semibold">Service livraison</h2><button type="button" onClick={() => setOpen(false)} disabled={pending} aria-label="Fermer"><X size={18} /></button></div>
        <p className="mb-4 text-sm text-slate-500">Le bouton « Notif » de chaque vente confirmée enverra un ticket WhatsApp à ce numéro.</p>
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-sm font-medium">Numéro WhatsApp de livraison<input name="phone" type="tel" required defaultValue={phone || ''} placeholder="+212612345678" className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 text-slate-900 dark:border-slate-600" /></label>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={pending} className="w-full rounded-lg bg-slate-900 p-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? 'Enregistrement...' : 'Enregistrer le numéro'}</button>
        </form>
      </section>
    </div>}
  </>;
}
