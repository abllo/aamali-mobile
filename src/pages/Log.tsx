import { useMemo, useState } from 'react';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { useApp, useRecords } from '../hooks/useApp';
import { DaySheet } from '../components/DaySheet';
import { Card, Page, Spinner, cx } from '../components/ui';
import { monthName } from '../lib/notify';
import { calcMonth, clockText, dotOf, dur, hm, KIND_LABEL, monthDays, monthOf, weekday, type Dot } from '../lib/rules';

const DOT: Record<Dot, { c: string; label: string } | null> = {
  present: { c: 'bg-good', label: 'حاضر' },
  short: { c: 'bg-[#BCC800]', label: 'تقصير' },
  open: { c: 'bg-brand live-dot', label: 'قيد العمل' },
  rest: { c: 'bg-line', label: 'راحة' },
  absent: { c: 'bg-danger', label: 'غياب' },
  leave: { c: 'bg-[#3B6FD8]', label: 'إجازة' },
  excuse: { c: 'bg-sky', label: 'استئذان' },
  external: { c: 'bg-violet', label: 'تكليف · عن بعد · دورة' },
  none: null,
};
const WD = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

function shift(month: string, n: number) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default function Log() {
  const { now, settings } = useApp();
  const [month, setMonth] = useState(monthOf(now.date));
  const [edit, setEdit] = useState<string | null>(null);
  const q = useRecords(month);
  const records = useMemo(() => q.data ?? {}, [q.data]);
  const m = useMemo(() => (settings ? calcMonth(month, records, settings, now.date) : null), [settings, month, records, now.date]);
  if (!settings || !m) return <Spinner />;

  const days = monthDays(month);
  const lead = weekday(days[0]!);
  const isCurrent = month === monthOf(now.date);

  return (
    <Page title="السجل"
      action={
        <div className="flex items-center gap-1">
          <button aria-label="الشهر السابق" onClick={() => setMonth(shift(month, -1))} className="flex size-9 items-center justify-center rounded-full bg-surface"><CaretRight className="size-4" weight="bold" /></button>
          <button aria-label="الشهر التالي" disabled={isCurrent} onClick={() => setMonth(shift(month, 1))} className="flex size-9 items-center justify-center rounded-full bg-surface disabled:opacity-30"><CaretLeft className="size-4" weight="bold" /></button>
        </div>
      }>
      <Card className="p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <b className="text-[17px]">{monthName(month)}</b>
          <span className="text-[13px] text-muted">المستهلك <b className="num ltr text-ink">{hm(m.used)}</b> من {hm(settings.allowance)}</span>
        </div>
        <div className="grid grid-cols-7 text-center text-[11.5px] font-semibold text-faint">{WD.map((w) => <div key={w} className="py-1">{w}</div>)}</div>
        <div className="grid grid-cols-7 gap-y-1 text-center">
          {Array.from({ length: lead }, (_, i) => <div key={`x${i}`} />)}
          {m.days.map((c) => {
            const dot = DOT[dotOf(c, records[c.date])];
            const isToday = c.date === now.date;
            return (
              <button key={c.date} onClick={() => c.status !== 'off' && c.date <= now.date && setEdit(c.date)}
                className={cx('flex flex-col items-center gap-1 rounded-xl py-1.5 transition active:bg-surface-2', c.date > now.date && 'opacity-40')}>
                <span className={cx('num flex size-7 items-center justify-center rounded-full text-[14px] font-semibold', isToday && 'bg-brand text-brand-ink')}>{Number(c.date.slice(8))}</span>
                <span className={cx('size-1.5 rounded-full', dot?.c ?? 'bg-transparent')} />
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 border-t border-line px-1 pt-2.5 text-[11.5px] text-muted">
          {(['present', 'short', 'absent', 'excuse', 'leave', 'external', 'rest'] as Dot[]).map((k) => (
            <span key={k} className="flex items-center gap-1"><span className={cx('size-2 rounded-full', DOT[k]!.c)} />{DOT[k]!.label}</span>
          ))}
        </div>
      </Card>

      <section className="space-y-2">
        {[...m.days].reverse().filter((c) => c.status !== 'off' && c.status !== 'future').map((c) => {
          const rec = records[c.date];
          const blocked = c.status === 'blocked';
          return (
            <Card key={c.date} onClick={() => setEdit(c.date)} className="flex items-center gap-3 py-3">
              <div className="w-12 shrink-0 text-center">
                <div className="num text-[20px] font-bold leading-none">{Number(c.date.slice(8))}</div>
                <div className="mt-0.5 text-[11px] text-muted">{WD[weekday(c.date)]}</div>
              </div>
              <div className="min-w-0 flex-1">
                {blocked ? <div className="font-semibold">{KIND_LABEL[rec?.kind ?? 'work']}</div> : (
                  <div className="flex items-center gap-4 text-[14px]">
                    <span><span className="text-[11.5px] text-muted">حضور </span><b className="num">{c.enter != null ? clockText(c.enter) : '—'}</b></span>
                    <span><span className="text-[11.5px] text-muted">انصراف </span><b className="num">{c.exit != null ? clockText(c.exit) : c.status === 'open' ? 'قيد العمل' : '—'}</b></span>
                  </div>
                )}
                {(rec?.note || rec?.excuseState || c.provisional) && (
                  <div className="mt-0.5 truncate text-[12px] text-muted">
                    {rec?.excuseState === 'submitted' && 'استئذان مقدَّم · '}{rec?.excuseState === 'approved' && `استئذان معتمد ${dur(c.credit)} · `}
                    {c.provisional && 'وقت مبدئي · '}{rec?.note}
                  </div>
                )}
              </div>
              <div className={cx('shrink-0 rounded-full px-2.5 py-1 text-[12.5px] font-bold',
                c.status === 'complete' ? (c.used ? 'bg-warn-soft text-warn' : 'bg-good-soft text-good')
                  : c.status === 'absent' || c.status === 'missingExit' ? 'bg-danger-soft text-danger' : 'bg-surface-2 text-muted')}>
                {c.status === 'complete' ? (c.used ? dur(c.used) : '✓') : c.status === 'absent' ? 'غير مكتمل' : c.status === 'missingExit' ? 'دون انصراف' : c.status === 'open' ? 'قيد العمل' : '—'}
              </div>
            </Card>
          );
        })}
        {m.days.every((c) => c.status === 'off' || c.status === 'future') && <p className="py-10 text-center text-muted">لا توجد بيانات</p>}
      </section>
      {edit && <DaySheet date={edit} onClose={() => setEdit(null)} />}
    </Page>
  );
}
