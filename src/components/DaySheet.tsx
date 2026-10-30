import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useApp, useDeleteDay, useSaveDay } from '../hooks/useApp';
import { dayName } from '../lib/notify';
import { calcDay, clockText, dur, KIND_LABEL, type DayKind, type DayRecord } from '../lib/rules';
import { Button, Group, Row, Segmented, Sheet, Toggle, cx } from './ui';

const KINDS: DayKind[] = ['work', 'excuse', 'leave', 'external', 'training', 'holiday'];
const SOURCE: Record<string, string> = { hadir: 'حاضر+', last: 'حاضر+ (آخر بصمة)', success: 'مبدئي', manual: 'يدوي', open: 'تقريبي' };

/** تعديل يوم: الأوقات، نوع اليوم، الاستئذان الجزئي */
export function DaySheet({ date, onClose }: { date: string; onClose: () => void }) {
  const { records, settings, now } = useApp();
  const save = useSaveDay();
  const del = useDeleteDay();
  const rec = records[date];
  const [open, setOpen] = useState(true);
  const [r, setR] = useState<DayRecord>(() => ({ date, kind: 'work', ...rec }));
  useEffect(() => { if (!open) { const t = setTimeout(onClose, 250); return () => clearTimeout(t); } }, [open, onClose]);
  if (!settings) return null;

  const kind = (r.kind ?? 'work') as DayKind;
  const c = calcDay(date, { ...r, excuseState: r.excuseState === 'submitted' ? 'approved' : r.excuseState }, settings, now.date);
  const set = (p: Partial<DayRecord>) => setR((x) => ({ ...x, ...p }));

  const submit = () => {
    const clean: DayRecord = kind === 'work'
      ? { ...r, kind: 'work', enterSource: r.enter !== rec?.enter ? 'manual' : r.enterSource, exitSource: r.exit !== rec?.exit ? 'manual' : r.exitSource }
      : { date, kind, enter: null, exit: null, note: r.note, excuseMinutes: null, excuseState: null };
    save.mutate(clean, { onSuccess: () => { toast.success('تم الحفظ'); setOpen(false); } });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen} title={dayName(date)}>
      <div className="space-y-5">
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {KINDS.map((k) => (
            <button key={k} type="button" onClick={() => set({ kind: k })}
              className={cx('h-9 shrink-0 rounded-full px-4 text-[14px] font-semibold transition', kind === k ? 'bg-brand text-brand-ink' : 'bg-surface text-muted')}>
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>

        {kind === 'work' ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <TimeBox label="الحضور" value={r.enter ?? ''} onChange={(v) => set({ enter: v || null })} hint={rec?.enter && rec.enterSource ? SOURCE[rec.enterSource] : undefined} />
              <TimeBox label="الانصراف" value={r.exit ?? ''} onChange={(v) => set({ exit: v || null })} hint={rec?.exit && rec.exitSource ? SOURCE[rec.exitSource] : undefined} />
            </div>
            {c.expected != null && (
              <div className="rounded-card bg-surface p-4 text-[14px]">
                <div className="flex justify-between"><span className="text-muted">وقت الانصراف المطلوب</span><b>{clockText(c.expectedSafe ?? c.expected)}</b></div>
                {c.status === 'complete' && (
                  <div className="mt-2 flex justify-between"><span className="text-muted">المحتسب</span>
                    <b className={c.raw ? 'text-warn' : 'text-good'}>{c.raw ? dur(c.raw) : 'لا يوجد'}{c.late ? ` (تأخير ${dur(c.late)})` : ''}</b>
                  </div>
                )}
              </div>
            )}
            {c.status === 'complete' && c.raw > 0 && (
              <Group header="استئذان جزئي">
                <Row label="طلب استئذان">
                  <Toggle label="طلب استئذان" checked={!!r.excuseState} onChange={(v) => set({ excuseState: v ? 'submitted' : null, excuseMinutes: v ? c.raw : null })} />
                </Row>
                {r.excuseState && (
                  <>
                    <Row label="المدة (دقيقة)">
                      <input type="number" inputMode="numeric" min={0} max={c.raw} value={r.excuseMinutes ?? c.raw}
                        onChange={(e) => set({ excuseMinutes: Math.max(0, Math.min(c.raw, Number(e.target.value) || 0)) })}
                        className="num h-9 w-20 rounded-xl bg-surface-2 text-center text-[16px] font-bold outline-none" />
                    </Row>
                    <div className="px-4 py-3">
                      <Segmented value={r.excuseState} onChange={(v) => set({ excuseState: v })}
                        options={[{ value: 'submitted', label: 'مقدَّم' }, { value: 'approved', label: 'معتمد' }]} />
                    </div>
                  </>
                )}
              </Group>
            )}
          </>
        ) : (
          <p className="rounded-card bg-surface p-4 text-center text-[14px] text-muted">{KIND_LABEL[kind]} · لا يُحتسب من الرصيد</p>
        )}

        <label className="block rounded-card bg-surface p-4">
          <span className="mb-1 block text-[13px] font-semibold text-muted">ملاحظة</span>
          <input value={r.note ?? ''} onChange={(e) => set({ note: e.target.value })} placeholder=""
            className="h-10 w-full bg-transparent text-[16px] outline-none" />
        </label>

        <Button className="w-full" loading={save.isPending} onClick={submit}>حفظ</Button>
        {rec && (
          <button type="button" className="w-full py-2 text-[15px] font-semibold text-danger"
            onClick={() => del.mutate(date, { onSuccess: () => { toast.success('تم الحذف'); setOpen(false); } })}>
            حذف بيانات اليوم
          </button>
        )}
      </div>
    </Sheet>
  );
}

function TimeBox({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <label className="block rounded-card bg-surface p-3 text-center">
      <span className="block text-[13px] font-semibold text-muted">{label}</span>
      <input type="time" value={value} onChange={(e) => onChange(e.target.value)}
        className="num mt-1 h-11 w-full rounded-xl bg-surface-2 text-center text-[20px] font-bold outline-none" />
      <span className="mt-1 block h-4 text-[11px] text-faint">{hint ?? ''}</span>
    </label>
  );
}
