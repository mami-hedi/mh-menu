import { useEffect, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Clock, Eye, QrCode, TrendingUp, Users } from 'lucide-react';
import { Alert, Card, Spinner } from '../../components/ui.jsx';
import { api, parseError } from '../../services/api.js';
import { usePageMeta } from '../../hooks/usePageMeta.js';
import { formatShortDay } from '../../lib/format.js';

const RANGES = [{ days: 7, label: '7 jours' }, { days: 30, label: '30 jours' }, { days: 90, label: '90 jours' }];
const hh = (h) => `${String(h).padStart(2, '0')}h`;

function Kpi({ icon: Icon, label, value, sub }) {
  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <div className="flex items-center gap-2 text-xs font-semibold text-navy-500 sm:text-sm"><Icon className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="truncate">{label}</span></div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{value}</div>
      {sub && <div className="mt-1 text-xs text-navy-500">{sub}</div>}
    </Card>
  );
}

function Trend({ current, previous }) {
  if (!previous && !current) return <span>Pas encore de données</span>;
  if (!previous) return <span>Nouveau sur la période</span>;
  const pct = Math.round(((current - previous) / previous) * 100);
  const up = pct >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return <span className={`inline-flex items-center gap-0.5 font-semibold ${up ? 'text-emerald-700' : 'text-red-700'}`}><Icon className="h-3.5 w-3.5" aria-hidden="true" />{up ? '+' : ''}{pct}% <span className="font-normal text-navy-500">vs période précédente</span></span>;
}

function DaysChart({ series }) {
  const max = Math.max(1, ...series.map((d) => d.views));
  const dense = series.length > 14;
  const every = series.length > 30 ? 10 : 5;
  return (
    <div className="mt-6 flex h-44 items-end gap-px sm:gap-1.5" role="img" aria-label={`Consultations par jour : ${series.map((d) => `${formatShortDay(d.day)} ${d.views}`).join(', ')}`}>
      {series.map((d, i) => (
        <div key={d.day} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
          {!dense && <span className="text-xs font-semibold text-navy-500">{d.views}</span>}
          <div title={`${formatShortDay(d.day)} : ${d.views}`} className="w-full rounded-t bg-accent-500/80" style={{ height: `${Math.max(3, (d.views / max) * 100)}%`, opacity: d.views ? 1 : 0.25 }} />
          <span className="h-4 whitespace-nowrap text-[10px] capitalize text-navy-500 sm:text-[11px]">{!dense || i % every === 0 ? formatShortDay(d.day) : ''}</span>
        </div>
      ))}
    </div>
  );
}

function HoursChart({ hours }) {
  const max = Math.max(1, ...hours.map((h) => h.views));
  return (
    <div className="mt-6 flex h-32 items-end gap-px sm:gap-1" role="img" aria-label={`Consultations par heure : ${hours.filter((h) => h.views).map((h) => `${hh(h.hour)} ${h.views}`).join(', ') || 'aucune'}`}>
      {hours.map((h) => (
        <div key={h.hour} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <div title={`${hh(h.hour)} : ${h.views}`} className="w-full rounded-t bg-navy-700/80" style={{ height: `${Math.max(3, (h.views / max) * 100)}%`, opacity: h.views ? 1 : 0.2 }} />
          <span className="h-4 text-[10px] text-navy-500">{h.hour % 6 === 0 ? hh(h.hour) : ''}</span>
        </div>
      ))}
    </div>
  );
}

export default function Stats() {
  usePageMeta('Statistiques – MH Menu');
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setError('');
    api.get('/restaurant/stats', { params: { days } }).then((r) => { if (alive) setData(r.data); }).catch((e) => { if (alive) setError(parseError(e).message); });
    return () => { alive = false; };
  }, [days]);

  const t = data?.totals;
  const tableMax = Math.max(1, ...(data?.tables.map((x) => x.views) ?? [1]));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-extrabold tracking-tight">Statistiques</h1><p className="mt-1 text-navy-500">Fréquentation de votre menu digital (heure de Tunisie).</p></div>
        <div role="group" aria-label="Période" className="inline-flex rounded-xl border border-navy-200 bg-white p-1">
          {RANGES.map((r) => (
            <button key={r.days} type="button" onClick={() => setDays(r.days)} aria-pressed={days === r.days}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold ${days === r.days ? 'bg-navy-900 text-white' : 'text-navy-700 hover:bg-navy-50'}`}>{r.label}</button>
          ))}
        </div>
      </div>

      {error && <Alert>{error}</Alert>}
      {!data && !error && <Spinner />}
      {data && (
        <div className={days !== data.days ? 'opacity-60 transition' : 'transition'} aria-busy={days !== data.days}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi icon={Eye} label="Consultations" value={t.views} sub={<Trend current={t.views} previous={t.previousViews} />} />
            <Kpi icon={Users} label="Visiteurs" value={t.visitors} sub="Visiteurs distincts, comptés chaque jour" />
            <Kpi icon={TrendingUp} label="Moyenne / jour" value={t.avgPerDay} sub={t.bestDay ? `Meilleur jour : ${formatShortDay(t.bestDay.day)} (${t.bestDay.views})` : 'Aucune consultation'} />
            <Kpi icon={Clock} label="Heure de pointe" value={t.peakHour === null ? '—' : hh(t.peakHour)} sub="Heure la plus consultée" />
          </div>

          <Card className="mt-6 p-5 sm:p-6">
            <h2 className="font-bold">Consultations par jour</h2>
            <DaysChart series={data.series} />
            {t.views === 0 && <p className="mt-4 text-center text-sm text-navy-500">Aucune consultation sur cette période. Elles apparaîtront dès que vos clients scanneront votre QR Code.</p>}
          </Card>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card className="p-5 sm:p-6">
              <h2 className="font-bold">Par heure de la journée</h2>
              <HoursChart hours={data.hours} />
            </Card>
            <Card className="p-5 sm:p-6">
              <h2 className="flex items-center gap-2 font-bold"><QrCode className="h-4 w-4 text-navy-500" aria-hidden="true" /> Par table</h2>
              {data.tables.length === 0 && data.withoutTable === 0 ? (
                <p className="mt-4 text-sm text-navy-500">Pas encore de données.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {data.tables.map((x) => (
                    <li key={x.table}>
                      <div className="flex items-baseline justify-between gap-3 text-sm"><span className="min-w-0 truncate font-semibold">{x.table}</span><span className="shrink-0 text-navy-500">{x.views}</span></div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-navy-50"><div className="h-full rounded-full bg-accent-500" style={{ width: `${(x.views / tableMax) * 100}%` }} /></div>
                    </li>
                  ))}
                  {data.withoutTable > 0 && <li className="flex items-baseline justify-between gap-3 border-t border-navy-100 pt-3 text-sm"><span className="text-navy-600">QR principal ou lien (sans table)</span><span className="shrink-0 text-navy-500">{data.withoutTable}</span></li>}
                </ul>
              )}
            </Card>
          </div>
          <p className="mt-6 text-xs text-navy-500">Par respect de la vie privée, aucune donnée personnelle n’est conservée : un visiteur est reconnu par une empreinte anonyme qui change chaque jour. Une même personne peut donc être comptée une fois par jour. Les statistiques par produit ne sont pas disponibles.</p>
        </div>
      )}
    </div>
  );
}
