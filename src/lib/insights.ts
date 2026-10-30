// أعمالي — مؤشرات من السجل (حساب مباشر من البيانات)
import { addDays, calcDay, clockText, dur, weekday, type DayCalc, type DayRecord, type Settings } from './rules';
import { weekdayName } from './notify';

export interface Indicator { id: string; tone: 'good' | 'warn' | 'info'; label: string; value: string }

/** الأيام المكتملة خلال آخر n يوم */
export function recentDays(records: Record<string, DayRecord>, s: Settings, today: string, n = 60): DayCalc[] {
  const out: DayCalc[] = [];
  for (let i = 1; i <= n; i++) {
    const d = addDays(today, -i);
    const c = calcDay(d, records[d], s, today);
    if (c.status === 'complete') out.push(c);
  }
  return out;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function indicators(records: Record<string, DayRecord>, s: Settings, today: string): Indicator[] {
  const days = recentDays(records, s, today);
  if (days.length < 3) return [];
  const out: Indicator[] = [
    { id: 'in', tone: 'info', label: 'متوسط الحضور', value: clockText(Math.round(avg(days.map((d) => d.enter!)))) },
    { id: 'out', tone: 'info', label: 'متوسط الانصراف', value: clockText(Math.round(avg(days.map((d) => d.exit!)))) },
  ];
  const byDay = new Map<number, number[]>();
  for (const d of days) byDay.set(weekday(d.date), [...(byDay.get(weekday(d.date)) ?? []), d.used]);
  const top = [...byDay.entries()].map(([k, v]) => ({ k, a: avg(v) })).sort((a, b) => b.a - a.a)[0];
  if (top && top.a >= 5) out.push({ id: 'day', tone: 'warn', label: 'أعلى يوم استهلاكاً', value: `${weekdayName(top.k)} · ${dur(top.a)}` });
  let streak = 0;
  for (const d of days) { if (d.used === 0) streak++; else break; }
  out.push({ id: 'streak', tone: streak >= 3 ? 'good' : 'info', label: 'أيام متتالية دون خصم', value: String(streak) });
  const late = days.reduce((a, d) => a + d.late, 0), early = days.reduce((a, d) => a + d.early, 0);
  if (late + early > 0) {
    out.push({ id: 'late', tone: 'info', label: 'التأخير الصباحي', value: `${Math.round((late / (late + early)) * 100)}٪` });
    out.push({ id: 'early', tone: 'info', label: 'الانصراف المبكر', value: `${Math.round((early / (late + early)) * 100)}٪` });
  }
  return out;
}
