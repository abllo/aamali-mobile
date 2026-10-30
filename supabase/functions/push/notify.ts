// أعمالي — توقيت الإشعارات ونصوصها. مشتركة بين دالة الإشعارات (كل 5 دقائق) والواجهة.
import {
  addDays, calcMonth, calcToday, clockText, dur, hm, isWorkday, monthOf, nextRamadanStart, remediation,
  type DayRecord, type Min, type Settings,
} from './rules.ts';

export type NoticeCat = 'day' | 'remind' | 'balance' | 'geo' | 'custom';
export interface Notice { key: string; cat: NoticeCat; title: string; body?: string; url?: string }

export const CAT_LABEL: Record<NoticeCat, string> = {
  day: 'الحضور والانصراف',
  remind: 'التذكيرات',
  balance: 'الرصيد',
  geo: 'الموقع',
  custom: 'التنبيهات المخصصة',
};

const WEEKDAY = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const MONTH = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export function dayName(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${WEEKDAY[new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay()]} ${d} ${MONTH[m! - 1]}`;
}
export const monthName = (month: string) => `${MONTH[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
export const weekdayName = (i: number) => WEEKDAY[i]!;

/** نافذة «في وقتها»: من الوقت المحدد لمدة معينة (الدالة تمر كل 5 دقائق) */
const at = (now: Min, t: Min, window = 60) => now >= t && now < t + window;

export interface NoticeInput {
  records: Record<string, DayRecord>;
  settings: Settings;
  now: { date: string; min: Min };
}

/** الإشعارات المستحقة الآن. المرسل يتجاهل أي مفتاح سبق إرساله. */
export function dueNotices({ records, settings: s, now }: NoticeInput): Notice[] {
  const out: Notice[] = [];
  const today = now.date;
  const m = calcMonth(monthOf(today), records, s, today);
  const t = calcToday(m, records, s, now);
  const rec = records[today];
  const d = t.day;
  const work = isWorkday(today, s) && d.status !== 'blocked';

  if (work) {
    if (d.status === 'none' && at(now.min, t.schedule.flexStart + 5, 30)) {
      out.push({ key: `notyet-${today}`, cat: 'remind', title: 'لم تُسجَّل بصمة الحضور', body: 'اضغط لتسجيل حالة اليوم', url: './#/?ask=today' });
    }
    if (d.status === 'none' && at(now.min, t.flexEnd - 15, 15)) {
      out.push({ key: `flex-${today}`, cat: 'remind', title: 'تنتهي المرونة بعد 15 دقيقة',
        body: `بعد ${clockText(t.flexEnd)} يُحتسب تأخير، والانصراف ${clockText(t.schedule.latestExit)}`, url: './#/?ask=today' });
    }
    if (d.enter != null && d.expectedSafe != null) {
      const allowed = t.allowedExit != null && t.allowedExit < d.expectedSafe ? ` · المسموح ${clockText(t.allowedExit)}` : '';
      out.push({ key: `in-${today}`, cat: 'day', title: `تم تسجيل الحضور ${clockText(d.enter)}${d.late ? ` · تأخير ${dur(d.late)}` : ''}`,
        body: `الانصراف ${clockText(d.expectedSafe)}${d.status === 'open' ? allowed : ''}`, url: './' });
    }
    if (d.status === 'open' && d.enter != null && d.expectedSafe != null) {
      const exp = d.expectedSafe;
      const mid = Math.round((d.enter + exp) / 2);
      if (at(now.min, mid, 30)) {
        out.push({ key: `half-${today}`, cat: 'remind', title: `منتصف الدوام · المتبقي ${hm(exp - now.min)}`, body: `الانصراف ${clockText(exp)}`, url: './' });
      }
      if (t.allowedExit != null && t.allowedExit < exp - 5 && at(now.min, t.allowedExit, 30)) {
        out.push({ key: `allowed-${today}`, cat: 'remind', title: 'يمكنك الانصراف الآن ضمن خطة الشهر',
          body: `الخصم ${dur(exp - now.min + d.late)} · الانصراف الكامل ${clockText(exp)}`, url: './' });
      }
      if (at(now.min, exp - 15, 15)) {
        out.push({ key: `pre-${today}`, cat: 'remind', title: `تبقّى 15 دقيقة على الانصراف`, body: clockText(exp), url: './' });
      }
      if (at(now.min, exp, 20)) {
        out.push({ key: `exitnow-${today}`, cat: 'remind', title: 'حان وقت الانصراف', body: 'سجّل بصمة الانصراف', url: './' });
      }
      if (at(now.min, exp + 20, 120)) {
        out.push({ key: `exitdue-${today}`, cat: 'remind', title: 'لم تُسجَّل بصمة الانصراف', body: 'افتح حاضر+ للتحديث، أو أضف بصمة يدوية', url: './' });
      }
    }
    if (d.status === 'complete' && d.exit != null) {
      const after = s.allowance - m.used;
      out.push({ key: `out-${today}`, cat: 'day', title: `تم تسجيل الانصراف ${clockText(d.exit)} · ${d.used ? `خصم ${dur(d.used)}` : 'دون خصم'}`,
        body: after >= 0 ? `المتبقي من الرصيد ${hm(after)} من ${hm(s.allowance)}` : `تجاوز الرصيد بـ ${dur(-after)}`, url: './' });
    }
    if (rec?.arrivedAt && d.enter == null) {
      const a = toM(rec.arrivedAt);
      if (a != null && now.min >= a + 10) out.push({ key: `arrive-${today}`, cat: 'geo', title: 'وصلت مقر العمل ولم تُسجَّل بصمة الحضور', url: './' });
    }
    if (rec?.leftAt && d.status === 'open') {
      out.push({ key: `left-${today}`, cat: 'geo', title: 'غادرت مقر العمل ولم تُسجَّل بصمة الانصراف', url: './' });
    }
  }

  const y = lastWorkday(today, s);
  if (y && at(now.min, 7 * 60 + 30, 90)) {
    const yc = calcMonth(monthOf(y), records, s, today).days.find((x) => x.date === y);
    if (yc && (yc.status === 'missingExit' || yc.status === 'absent')) {
      out.push({ key: `missing-${y}`, cat: 'remind', title: `بيانات ${dayName(y)} غير مكتملة`,
        body: yc.status === 'absent' ? 'لا توجد بصمة' : 'لا يوجد وقت انصراف', url: './#/log' });
    }
  }

  const month = monthOf(today);
  if (m.used >= s.warnAt && m.used <= s.allowance) {
    out.push({ key: `warn-${month}`, cat: 'balance', title: `الاستهلاك ${hm(m.used)} من ${hm(s.allowance)}`,
      body: `المتبقي ${hm(m.remaining)} · المسموح يومياً ${dur(m.todayShare)}`, url: './#/balance' });
  }
  if (m.used > s.allowance) {
    const p = remediation(m, records, s);
    const first = p.items[0];
    out.push({ key: `over-${month}-${m.used}`, cat: 'balance', title: `تجاوز الرصيد بـ ${dur(m.used - s.allowance)}`,
      body: first ? `يُقترح استئذان ${dayName(first.date)} (${dur(first.minutes)})${p.items.length > 1 ? ` و${p.items.length - 1} يوم آخر` : ''}` : undefined, url: './#/balance' });
  }
  if (new Date(`${today}T12:00:00Z`).getUTCDay() === 4 && at(now.min, 16 * 60, 60) && m.completeCount >= 2) {
    out.push({ key: `week-${today}`, cat: 'balance',
      title: m.exceedDate ? `يُتوقع تجاوز الرصيد قبل ${dayName(m.exceedDate)}` : `ملخص الأسبوع · المتبقي ${hm(Math.max(0, m.remaining))}`,
      body: `متوسط الاستهلاك اليومي ${dur(m.avg)}`, url: './#/balance' });
  }

  for (const a of s.customAlerts ?? []) {
    const tm = toM(a.time);
    if (!a.on || tm == null || !a.text.trim()) continue;
    if (a.days === 'work' && !work) continue;
    if (at(now.min, tm, 20)) out.push({ key: `ca-${a.id}-${today}`, cat: 'custom', title: a.text.trim(), url: './' });
  }

  const r = nextRamadanStart(today, s);
  if (r && addDays(r, -1) === today && at(now.min, 20 * 60, 120)) {
    out.push({ key: `ramadan-${r}`, cat: 'remind', title: 'يبدأ رمضان غداً',
      body: `دوام رمضان: ${clockText(s.ramadan.flexStart)} – ${clockText(s.ramadan.flexStart + s.ramadan.hours)}`, url: './#/more' });
  }
  return out.filter((n) => s.notify?.[n.cat] !== false);
}

function toM(t: string): Min | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function lastWorkday(date: string, s: Settings): string | null {
  for (let i = 1; i <= 7; i++) {
    const d = addDays(date, -i);
    if (isWorkday(d, s)) return d;
  }
  return null;
}
