// حضوري — مصدر البيانات: Supabase في التطبيق الحقيقي، وبيانات تجريبية في المعاينة.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_SETTINGS, riyadhNow, type DayRecord, type Min, type Settings } from './rules';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const DEMO = import.meta.env.MODE === 'preview' || !url || !key;
export const SUPABASE_URL = url || '';
export const SUPABASE_KEY = key || '';

export const supabase: SupabaseClient | null = DEMO ? null : createClient(url!, key!, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export interface Profile { settings: Settings; token: string }

// ---------- الوقت ----------
const DEMO_START = Date.now();
/** الوقت الحالي بتوقيت الرياض. في المعاينة: يوم دوام تجريبي يمشي مع الساعة */
export function nowRiyadh(): { date: string; min: Min } {
  if (!DEMO) return riyadhNow();
  const passed = Math.floor((Date.now() - DEMO_START) / 60000);
  return { date: '2026-11-11', min: 13 * 60 + 47 + passed };
}

// ---------- المعاينة ----------
const DEMO_KEY = 'hudoori-demo-v1';
function demoSeed(): { settings: Settings; records: Record<string, DayRecord> } {
  const r = (date: string, enter: string | null, exit: string | null, extra: Partial<DayRecord> = {}): DayRecord =>
    ({ date, enter, exit, enterSource: enter ? 'hadir' : null, exitSource: exit ? 'hadir' : null, ...extra });
  const list: DayRecord[] = [
    r('2026-10-25', '08:02', '15:04'), r('2026-10-26', '07:56', '14:47'), r('2026-10-29', '08:01', '14:33'),
    r('2026-10-27', null, null, { kind: 'external' }), r('2026-10-28', null, null, { kind: 'external' }),
    r('2026-11-01', '08:05', '15:05'),
    r('2026-11-02', '08:30', '15:10'),
    r('2026-11-03', '09:12', '16:00'),
    r('2026-11-04', '07:55', '15:02'),
    r('2026-11-05', '08:10', '14:20'),
    r('2026-11-08', null, null, { kind: 'external' }),
    r('2026-11-09', '08:20', '15:20'),
    r('2026-11-10', '08:40', '15:05'),
    r('2026-11-11', '08:14', null),
  ];
  return { settings: { ...DEFAULT_SETTINGS, managerPool: 600 }, records: Object.fromEntries(list.map((x) => [x.date, x])) };
}
function demoLoad() {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (raw) return JSON.parse(raw) as ReturnType<typeof demoSeed>;
  } catch { /* المعاينة تشتغل حتى بدون تخزين */ }
  return demoSeed();
}
let demo = demoLoad();
function demoSave() { try { localStorage.setItem(DEMO_KEY, JSON.stringify(demo)); } catch { /* تجاهل */ } }
export function resetDemo() { demo = demoSeed(); demoSave(); }

// ---------- الواجهة الموحدة ----------
type Row = {
  date: string; enter: string | null; exit: string | null; enter_source: string | null; exit_source: string | null;
  kind: string | null; excuse_minutes: number | null; excuse_state: string | null; note: string | null;
  arrived_at: string | null; left_at: string | null;
};
const fromRow = (x: Row): DayRecord => ({
  date: x.date, enter: x.enter, exit: x.exit, enterSource: x.enter_source as DayRecord['enterSource'], exitSource: x.exit_source as DayRecord['exitSource'],
  kind: x.kind as DayRecord['kind'], excuseMinutes: x.excuse_minutes, excuseState: x.excuse_state as DayRecord['excuseState'], note: x.note,
  arrivedAt: x.arrived_at, leftAt: x.left_at,
});
const toRow = (r: DayRecord) => ({
  date: r.date, enter: r.enter || null, exit: r.exit || null, enter_source: r.enter ? r.enterSource ?? 'manual' : null, exit_source: r.exit ? r.exitSource ?? 'manual' : null,
  kind: r.kind && r.kind !== 'work' ? r.kind : null, excuse_minutes: r.excuseMinutes ?? null, excuse_state: r.excuseState ?? null, note: r.note || null,
});

export async function loadProfile(): Promise<Profile> {
  if (DEMO) return { settings: demo.settings, token: 'demo-token' };
  const { data, error } = await supabase!.rpc('my_profile');
  if (error) throw error;
  return { settings: { ...DEFAULT_SETTINGS, ...(data?.settings ?? {}) }, token: data?.token ?? '' };
}

export async function saveSettings(settings: Settings): Promise<void> {
  if (DEMO) { demo.settings = settings; demoSave(); return; }
  const { error } = await supabase!.rpc('save_settings', { p_settings: settings });
  if (error) throw error;
}

export async function loadRecords(from: string, to: string): Promise<Record<string, DayRecord>> {
  if (DEMO) return Object.fromEntries(Object.entries(demo.records).filter(([d]) => d >= from && d <= to));
  const { data, error } = await supabase!.from('days').select('*').gte('date', from).lte('date', to);
  if (error) throw error;
  return Object.fromEntries((data as Row[]).map((x) => [x.date, fromRow(x)]));
}

export async function saveDay(r: DayRecord): Promise<void> {
  if (DEMO) { demo.records[r.date] = { ...demo.records[r.date], ...r }; demoSave(); return; }
  const { error } = await supabase!.rpc('save_day', { p_day: toRow(r) });
  if (error) throw error;
}

export async function deleteDay(date: string): Promise<void> {
  if (DEMO) { delete demo.records[date]; demoSave(); return; }
  const { error } = await supabase!.from('days').delete().eq('date', date);
  if (error) throw error;
}

export async function rotateToken(): Promise<string> {
  if (DEMO) return 'demo-token';
  const { data, error } = await supabase!.rpc('rotate_token');
  if (error) throw error;
  return data as string;
}
