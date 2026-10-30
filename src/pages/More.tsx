import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Bell, BellRinging, Clock, Copy, Crown, DownloadSimple, Fingerprint, Gauge, MapPin, Moon, Plus, SignOut, Warning } from '@phosphor-icons/react';
import { useApp, useSaveSettings } from '../hooks/useApp';
import { Button, Group, Page, Row, Segmented, Sheet, Toggle } from '../components/ui';
import { DEMO, SUPABASE_KEY, SUPABASE_URL, loadRecords, rotateToken, supabase } from '../lib/data';
import { CAT_LABEL, type NoticeCat } from '../lib/notify';
import { usePush } from '../lib/push';
import { clockText, dur, fromMin, hm, toMin, type CustomAlert, type Schedule, type Settings } from '../lib/rules';

type Panel = null | 'normal' | 'ramadan' | 'allowance' | 'warn' | 'pool' | 'shortcut' | 'geo' | { alert: CustomAlert };

export default function More() {
  const { settings, token, now } = useApp();
  const save = useSaveSettings();
  const push = usePush();
  const [panel, setPanel] = useState<Panel>(null);
  if (!settings) return null;
  const set = (p: Partial<Settings>) => save.mutate({ ...settings, ...p });

  return (
    <Page title="الإعدادات" action={<img src="./logo-mark-green.png" alt="أعمالي" className="h-9 w-auto dark:hidden" />}>
      <Group header="الإشعارات" footer={push.availability === 'install-first' ? 'أضف التطبيق إلى الشاشة الرئيسية لتفعيل الإشعارات.' : undefined}>
        <Row icon={BellRinging} tint="bg-danger" label={push.enabled ? 'مفعّلة على هذا الجهاز' : 'تفعيل الإشعارات'} hint={push.availability === 'denied' ? 'مرفوضة من إعدادات الجهاز' : undefined}>
          {push.availability === 'ok' && (push.enabled
            ? <button className="text-[14px] font-semibold text-brand" onClick={() => push.test().then(() => toast.success('تم الإرسال')).catch((e) => toast.error(e.message))}>اختبار</button>
            : <Button className="h-9 rounded-xl px-4 text-[14px]" loading={push.loading} onClick={() => push.enable().then(() => toast.success('تم التفعيل')).catch((e) => toast.error(e.message))}>تفعيل</Button>)}
        </Row>
        {(Object.keys(CAT_LABEL) as NoticeCat[]).map((k) => (
          <Row key={k} label={CAT_LABEL[k]}>
            <Toggle label={CAT_LABEL[k]} checked={settings.notify?.[k] !== false} onChange={(v) => set({ notify: { ...settings.notify, [k]: v } })} />
          </Row>
        ))}
      </Group>

      <Group header="التنبيهات المخصصة">
        {(settings.customAlerts ?? []).map((a) => (
          <Row key={a.id} icon={Bell} tint="bg-gold" label={a.text || '—'} hint={`${clockText(toMin(a.time) ?? 0)} · ${a.days === 'work' ? 'أيام العمل' : 'يومياً'}`} onClick={() => setPanel({ alert: a })}>
            <span onClick={(e) => e.stopPropagation()}>
              <Toggle label="تشغيل" checked={a.on} onChange={(v) => set({ customAlerts: settings.customAlerts.map((x) => (x.id === a.id ? { ...x, on: v } : x)) })} />
            </span>
          </Row>
        ))}
        <Row icon={Plus} tint="bg-brand" label="إضافة تنبيه" onClick={() => setPanel({ alert: { id: `ca${Date.now().toString(36)}`, time: '14:45', text: '', days: 'work', on: true } })} />
      </Group>

      <Group header="الدوام والرصيد">
        <Row icon={Clock} tint="bg-brand" label="الدوام" value={sched(settings.normal)} onClick={() => setPanel('normal')} chevron />
        <Row icon={Moon} tint="bg-violet" label="دوام رمضان" value={sched(settings.ramadan)} onClick={() => setPanel('ramadan')} chevron />
        <Row icon={Gauge} tint="bg-good" label="السماح الشهري" value={<span className="num ltr">{hm(settings.allowance)}</span>} onClick={() => setPanel('allowance')} chevron />
        <Row icon={Warning} tint="bg-warn" label="حد التنبيه" value={<span className="num ltr">{hm(settings.warnAt)}</span>} onClick={() => setPanel('warn')} chevron />
        <Row icon={Crown} tint="bg-sky" label="رصيد ساعات المدير" value={settings.managerPool != null ? <span className="num ltr">{hm(settings.managerPool)}</span> : 'غير محدد'} onClick={() => setPanel('pool')} chevron />
      </Group>

      <Group header="الربط">
        <Row icon={Fingerprint} tint="bg-brand" label="اختصار حاضر+" onClick={() => setPanel('shortcut')} chevron />
        <Row icon={MapPin} tint="bg-danger" label="الموقع" onClick={() => setPanel('geo')} chevron />
      </Group>

      <Group header="البيانات">
        <Row icon={DownloadSimple} tint="bg-faint" label="تصدير السجل" onClick={() => exportCsv(now.date)} />
        {!DEMO && <Row icon={SignOut} tint="bg-danger" label="تسجيل الخروج" danger onClick={() => supabase!.auth.signOut()} />}
      </Group>

      <p className="pt-2 text-center text-[12px] text-faint">أعمالي</p>

      {(panel === 'normal' || panel === 'ramadan') && (
        <ScheduleSheet title={panel === 'normal' ? 'الدوام' : 'دوام رمضان'} value={settings[panel]} onClose={() => setPanel(null)}
          onSave={(v) => set({ [panel]: v } as Partial<Settings>)} />
      )}
      {panel === 'allowance' && <DurationSheet title="السماح الشهري" value={settings.allowance} onClose={() => setPanel(null)} onSave={(v) => set({ allowance: v ?? 419 })} />}
      {panel === 'warn' && <DurationSheet title="حد التنبيه" value={settings.warnAt} onClose={() => setPanel(null)} onSave={(v) => set({ warnAt: v ?? 300 })} />}
      {panel === 'pool' && <DurationSheet title="رصيد ساعات المدير" optional value={settings.managerPool ?? null} onClose={() => setPanel(null)} onSave={(v) => set({ managerPool: v })} />}
      {panel === 'shortcut' && <ShortcutSheet token={token ?? ''} onClose={() => setPanel(null)} />}
      {panel === 'geo' && <GeoSheet token={token ?? ''} onClose={() => setPanel(null)} />}
      {panel && typeof panel === 'object' && (
        <AlertSheet alert={panel.alert} onClose={() => setPanel(null)}
          onSave={(a) => { const list = settings.customAlerts ?? []; set({ customAlerts: list.some((x) => x.id === a.id) ? list.map((x) => (x.id === a.id ? a : x)) : [...list, a] }); }}
          onDelete={(id) => set({ customAlerts: (settings.customAlerts ?? []).filter((x) => x.id !== id) })} />
      )}
    </Page>
  );
}

const sched = (s: Schedule) => s.flexEnd > s.flexStart ? `${clock2(s.flexStart)}–${clock2(s.flexEnd)} · ${dur(s.hours)}` : `${clock2(s.flexStart)} · ${dur(s.hours)}`;
const clock2 = (m: number) => clockText(m).replace(/ (ص|م)$/, '');

function useClosing(onClose: () => void): [boolean, (o: boolean) => void] {
  const [open, setOpen] = useState(true);
  return [open, (o) => { setOpen(o); if (!o) setTimeout(onClose, 250); }];
}

function TimeRow({ label, value, onChange }: { label: string; value: number; onChange: (m: number) => void }) {
  return (
    <Row label={label}>
      <input type="time" value={fromMin(value)} onChange={(e) => { const m = toMin(e.target.value); if (m != null) onChange(m); }}
        className="num h-9 rounded-xl bg-surface-2 px-2 text-[16px] font-semibold outline-none" />
    </Row>
  );
}

function ScheduleSheet({ title, value, onSave, onClose }: { title: string; value: Schedule; onSave: (s: Schedule) => void; onClose: () => void }) {
  const [open, setOpen] = useClosing(onClose);
  const [s, setS] = useState(value);
  return (
    <Sheet open={open} onOpenChange={setOpen} title={title}>
      <div className="space-y-5">
        <Group>
          <TimeRow label="بداية المرونة" value={s.flexStart} onChange={(m) => setS({ ...s, flexStart: m, flexEnd: Math.max(m, s.flexEnd), latestExit: Math.max(m, s.flexEnd) + s.hours })} />
          <TimeRow label="نهاية المرونة" value={s.flexEnd} onChange={(m) => setS({ ...s, flexEnd: Math.max(m, s.flexStart), latestExit: Math.max(m, s.flexStart) + s.hours })} />
          <Row label="ساعات الدوام">
            <input type="number" inputMode="decimal" step="0.5" min={1} max={12} value={s.hours / 60}
              onChange={(e) => { const h = Math.round((Number(e.target.value) || 0) * 60); if (h > 0) setS({ ...s, hours: h, latestExit: s.flexEnd + h }); }}
              className="num h-9 w-20 rounded-xl bg-surface-2 text-center text-[16px] font-semibold outline-none" />
          </Row>
          <TimeRow label="آخر وقت انصراف" value={s.latestExit} onChange={(m) => setS({ ...s, latestExit: m })} />
        </Group>
        <Button className="w-full" onClick={() => { onSave(s); setOpen(false); }}>حفظ</Button>
      </div>
    </Sheet>
  );
}

function DurationSheet({ title, value, optional, onSave, onClose }: { title: string; value: number | null; optional?: boolean; onSave: (v: number | null) => void; onClose: () => void }) {
  const [open, setOpen] = useClosing(onClose);
  const [h, setH] = useState(value != null ? Math.floor(value / 60) : 0);
  const [m, setM] = useState(value != null ? value % 60 : 0);
  return (
    <Sheet open={open} onOpenChange={setOpen} title={title}>
      <div className="space-y-5">
        <div className="flex items-center justify-center gap-3 rounded-card bg-surface p-5" dir="ltr">
          <NumBox value={h} max={99} onChange={setH} label="ساعة" />
          <span className="text-[30px] font-bold">:</span>
          <NumBox value={m} max={59} onChange={setM} label="دقيقة" />
        </div>
        <Button className="w-full" onClick={() => { onSave(h * 60 + m); setOpen(false); }}>حفظ</Button>
        {optional && value != null && <button className="w-full py-2 text-[15px] font-semibold text-danger" onClick={() => { onSave(null); setOpen(false); }}>مسح</button>}
      </div>
    </Sheet>
  );
}
function NumBox({ value, max, onChange, label }: { value: number; max: number; onChange: (v: number) => void; label: string }) {
  return (
    <label className="flex flex-col items-center gap-1">
      <input type="number" inputMode="numeric" min={0} max={max} value={value} onChange={(e) => onChange(Math.max(0, Math.min(max, Number(e.target.value) || 0)))}
        className="num h-16 w-24 rounded-2xl bg-surface-2 text-center text-[34px] font-bold outline-none" />
      <span className="text-[12px] text-muted">{label}</span>
    </label>
  );
}

function AlertSheet({ alert, onSave, onDelete, onClose }: { alert: CustomAlert; onSave: (a: CustomAlert) => void; onDelete: (id: string) => void; onClose: () => void }) {
  const [open, setOpen] = useClosing(onClose);
  const [a, setA] = useState(alert);
  return (
    <Sheet open={open} onOpenChange={setOpen} title="تنبيه">
      <div className="space-y-5">
        <Group>
          <TimeRow label="الوقت" value={toMin(a.time) ?? 0} onChange={(m) => setA({ ...a, time: fromMin(m) })} />
          <div className="px-4 py-3">
            <input value={a.text} onChange={(e) => setA({ ...a, text: e.target.value })} placeholder="نص التنبيه"
              className="h-11 w-full rounded-xl bg-surface-2 px-3 text-[16px] outline-none" />
          </div>
          <div className="px-4 py-3"><Segmented value={a.days} onChange={(v) => setA({ ...a, days: v })} options={[{ value: 'work', label: 'أيام العمل' }, { value: 'all', label: 'يومياً' }]} /></div>
        </Group>
        <Button className="w-full" disabled={!a.text.trim()} onClick={() => { onSave(a); setOpen(false); }}>حفظ</Button>
        <button className="w-full py-2 text-[15px] font-semibold text-danger" onClick={() => { onDelete(a.id); setOpen(false); }}>حذف</button>
      </div>
    </Sheet>
  );
}

function Copyable({ label, value }: { label: string; value: string }) {
  return (
    <Row label={label} hint={<span className="ltr block truncate">{value || '—'}</span>}>
      <button aria-label={`نسخ ${label}`} className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-brand"
        onClick={() => navigator.clipboard.writeText(value).then(() => toast.success('تم النسخ')).catch(() => toast('اضغط مطولاً على النص للنسخ'))}>
        <Copy className="size-4" weight="bold" />
      </button>
    </Row>
  );
}

function Steps({ children }: { children: ReactNode }) {
  return <ol className="list-decimal space-y-2.5 rounded-card bg-surface p-4 ps-8 text-[14px] leading-relaxed">{children}</ol>;
}

function ShortcutSheet({ token, onClose }: { token: string; onClose: () => void }) {
  const [open, setOpen] = useClosing(onClose);
  const [tk, setTk] = useState(token);
  return (
    <Sheet open={open} onOpenChange={setOpen} title="اختصار حاضر+">
      <div className="space-y-5">
        <Group>
          <Copyable label="الرابط" value={`${SUPABASE_URL}/rest/v1/rpc/hadir_ingest`} />
          <Copyable label="المفتاح (apikey)" value={SUPABASE_KEY} />
          <Copyable label="الرمز" value={tk} />
        </Group>
        <Steps>
          <li>داخل <b>If Any</b> أضف <b>Get Contents of URL</b> بالرابط.</li>
          <li><b>Method</b>: POST · <b>Headers</b>: <code className="ltr">apikey</code> = المفتاح.</li>
          <li><b>Request Body</b>: JSON · <code className="ltr">token</code> = الرمز · <code className="ltr">text</code> = <b>Extracted Text</b>.</li>
          <li>احذف <b>Text</b> و<b>Add Text to Log</b> و<b>Create Note</b>.</li>
        </Steps>
        <Group>
          <Row label="تغيير الرمز" onClick={() => rotateToken().then((t) => { setTk(t); toast.success('تم تغيير الرمز'); })} />
        </Group>
      </div>
    </Sheet>
  );
}

function GeoSheet({ token, onClose }: { token: string; onClose: () => void }) {
  const [open, setOpen] = useClosing(onClose);
  return (
    <Sheet open={open} onOpenChange={setOpen} title="الموقع">
      <div className="space-y-5">
        <Group>
          <Copyable label="الرابط" value={`${SUPABASE_URL}/rest/v1/rpc/geo_event`} />
          <Copyable label="المفتاح (apikey)" value={SUPABASE_KEY} />
          <Copyable label="الرمز" value={token} />
        </Group>
        <Steps>
          <li><b>Automation</b> ← <b>Arrive</b> ← موقع العمل ← <b>Run Immediately</b>.</li>
          <li><b>Get Contents of URL</b> · POST · <code className="ltr">apikey</code> · JSON: <code className="ltr">token</code> = الرمز، <code className="ltr">kind</code> = <code className="ltr">arrive</code>.</li>
          <li>كرّر مع <b>Leave</b> و<code className="ltr">kind</code> = <code className="ltr">leave</code>.</li>
        </Steps>
      </div>
    </Sheet>
  );
}

async function exportCsv(today: string) {
  const recs = await loadRecords('2020-01-01', today);
  const rows = [['التاريخ', 'الحضور', 'الانصراف', 'الحالة', 'استئذان (دقيقة)', 'حالة الطلب', 'ملاحظة']];
  for (const r of Object.values(recs).sort((a, b) => a.date.localeCompare(b.date))) {
    rows.push([r.date, r.enter ?? '', r.exit ?? '', r.kind ?? 'دوام', String(r.excuseMinutes ?? ''), r.excuseState === 'approved' ? 'معتمد' : r.excuseState === 'submitted' ? 'مقدَّم' : '', r.note ?? '']);
  }
  const csv = '﻿' + rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `أعمالي-الحضور-${today}.csv`;
  a.click();
}
