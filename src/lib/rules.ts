// حضوري — قواعد الحضور والانصراف (نفس منطق «أعمالي»، ومشتركة بين الواجهة ودالة الإشعارات).
// كل الأوقات بالدقائق من منتصف الليل، وكل المدد بالدقائق. لا يعتمد على أي مكتبة.

export type Min = number;

/** أنواع الأيام اللي ما تنحسب عليك (يوم كامل) */
export type DayKind = 'work' | 'excuse' | 'leave' | 'external' | 'training' | 'holiday';

export interface DayRecord {
  date: string;                 // YYYY-MM-DD
  enter?: string | null;        // HH:MM
  exit?: string | null;         // HH:MM
  enterSource?: Source | null;
  exitSource?: Source | null;
  kind?: DayKind | null;        // غير 'work' = يوم كامل محجوب
  excuseMinutes?: number | null; // استئذان جزئي انقبل (دقائق تنشال من استهلاك اليوم)
  excuseState?: 'submitted' | 'approved' | null;
  note?: string | null;
  arrivedAt?: string | null;    // وصلت موقع الدوام (من أتمتة الموقع)
  leftAt?: string | null;       // طلعت من موقع الدوام
}

/** من وين جا الوقت: خانة حاضر = رسمي، آخر بصمة = رسمي، لحظة النجاح = مؤقت، يدوي، أو من فتح التطبيق */
export type Source = 'hadir' | 'last' | 'success' | 'manual' | 'open';
export const OFFICIAL: Source[] = ['hadir', 'last', 'manual'];
export const SOURCE_RANK: Record<Source, number> = { open: 1, success: 2, last: 3, hadir: 4, manual: 5 };

export interface Schedule {
  flexStart: Min;   // قبله: خروجك ثابت = flexStart + hours
  flexEnd: Min;     // بعده: تأخير، وخروجك latestExit
  hours: Min;       // ساعات الدوام
  latestExit: Min;  // آخر وقت خروج مطلوب
}

export interface Settings {
  allowance: Min;            // 419 = 6:59
  workdays: number[];        // 0 = الأحد ... 6 = السبت
  normal: Schedule;
  ramadan: Schedule;
  ramadanStart?: string | null; // تعديل يدوي لبداية رمضان (لو اختلف الإعلان عن أم القرى)
  ramadanEnd?: string | null;
  managerPool?: Min | null;  // رصيد ساعات المدير (اختياري)
  warnAt: Min;               // تنبيه «قربت» (افتراضي 5:00)
  customAlerts: CustomAlert[]; // تنبيهات الدوام المخصصة (مثل «أعمالي»)
  notify: Record<string, boolean>; // تشغيل/إيقاف كل نوع إشعار
}

export interface CustomAlert { id: string; time: string; text: string; days: 'work' | 'all'; on: boolean }

export const NORMAL: Schedule = { flexStart: 480, flexEnd: 540, hours: 420, latestExit: 960 };
export const RAMADAN: Schedule = { flexStart: 600, flexEnd: 600, hours: 300, latestExit: 900 };
export const DEFAULT_SETTINGS: Settings = {
  allowance: 419,
  workdays: [0, 1, 2, 3, 4],
  normal: NORMAL,
  ramadan: RAMADAN,
  ramadanStart: null,
  ramadanEnd: null,
  managerPool: null,
  warnAt: 300,
  customAlerts: [{ id: 'ca1', time: '14:45', text: 'المتبقي على نهاية الدوام ١٥ دقيقة', days: 'work', on: false }],
  notify: { day: true, remind: true, balance: true, geo: true, custom: true },
};

export const KIND_LABEL: Record<DayKind, string> = {
  work: 'دوام',
  excuse: 'استئذان',
  leave: 'إجازة',
  external: 'تكليف خارجي',
  training: 'دورة تدريبية',
  holiday: 'عطلة',
};

// ---------- وقت وتاريخ ----------
export const pad = (n: number) => String(n).padStart(2, '0');

export function toMin(t?: string | null): Min | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  return h > 23 || mi > 59 ? null : h * 60 + mi;
}
/** الثواني لو الوقت فيه ثواني (من «تاريخ آخر بصمة» في حاضر+) */
export function secOf(t?: string | null): number {
  const m = /^\d{1,2}:\d{2}:(\d{2})/.exec(t ?? '');
  return m ? Number(m[1]) : 0;
}
export const fromMin = (m: Min) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;

/** 5:12 */
export const hm = (m: Min) => `${Math.floor(Math.abs(m) / 60)}:${pad(Math.abs(m) % 60)}`;
/** «1 س 5 د» أو «45 د» */
export function dur(m: Min): string {
  m = Math.max(0, Math.round(m));
  const h = Math.floor(m / 60), r = m % 60;
  if (!h) return `${r} د`;
  return r ? `${h} س ${r} د` : `${h} س`;
}
/** «1 ساعة و26 دقيقة» */
export function durLong(m: Min): string {
  m = Math.max(0, Math.round(m));
  const h = Math.floor(m / 60), r = m % 60;
  if (!h) return `${r} دقيقة`;
  return r ? `${h} ساعة و${r} دقيقة` : `${h} ساعة`;
}
/** 3:12 م */
export function clock(m: Min): { t: string; ap: string } {
  m = ((Math.round(m) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  return { t: `${h % 12 || 12}:${pad(m % 60)}`, ap: h >= 12 ? 'م' : 'ص' };
}
export const clockText = (m: Min) => { const c = clock(m); return `${c.t} ${c.ap}`; };

export function weekday(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const x = new Date(Date.UTC(y!, m! - 1, d! + n));
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
}
export const monthOf = (date: string) => date.slice(0, 7);
export function monthDays(month: string): string[] {
  const [y, m] = month.split('-').map(Number);
  const n = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${month}-${pad(i + 1)}`);
}

/** الوقت الحالي بتوقيت الرياض (يشتغل نفس الشيء في الجوال والسيرفر) */
export function riyadhNow(d = new Date()): { date: string; min: Min } {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute) };
}

/** الشهر الهجري بتقويم أم القرى (9 = رمضان) */
export function hijriMonth(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { month: 'numeric', timeZone: 'UTC' })
      .formatToParts(new Date(Date.UTC(y!, m! - 1, d!, 12)));
    return Number(parts.find((p) => p.type === 'month')?.value ?? 0);
  } catch { return 0; }
}

export function isRamadan(date: string, s: Settings): boolean {
  if (s.ramadanStart && s.ramadanEnd) return date >= s.ramadanStart && date <= s.ramadanEnd;
  return hijriMonth(date) === 9;
}

/** أول يوم رمضان القادم (لتذكير «عبّي دوام رمضان») — يبحث سنة للأمام */
export function nextRamadanStart(from: string, s: Settings): string | null {
  if (s.ramadanStart && s.ramadanStart >= from) return s.ramadanStart;
  for (let i = 0; i < 400; i++) {
    const d = addDays(from, i);
    if (hijriMonth(d) === 9 && hijriMonth(addDays(d, -1)) !== 9) return d;
  }
  return null;
}

export const scheduleFor = (date: string, s: Settings) => (isRamadan(date, s) ? s.ramadan : s.normal);
export const isWorkday = (date: string, s: Settings) => s.workdays.includes(weekday(date));

// ---------- اليوم ----------
/** وقت الخروج المطلوب حسب وقت دخولك */
export function expectedExit(enter: Min, sc: Schedule): Min {
  if (enter <= sc.flexStart) return sc.flexStart + sc.hours;
  if (enter <= sc.flexEnd) return Math.min(enter + sc.hours, sc.latestExit);
  return sc.latestExit;
}
export const lateOf = (enter: Min, sc: Schedule) => Math.max(0, enter - sc.flexEnd);

export type DayStatus =
  | 'off'         // جمعة/سبت
  | 'blocked'     // يوم كامل محجوب (استئذان/إجازة/تكليف/دورة/عطلة)
  | 'future'
  | 'none'        // ما فيه بيانات (اليوم قبل البصمة)
  | 'absent'      // يوم فات بدون أي بصمة
  | 'open'        // دخلت وما طلعت (اليوم)
  | 'missingExit' // يوم فات فيه دخول بدون خروج
  | 'complete';

export interface DayCalc {
  date: string;
  status: DayStatus;
  enter: Min | null;
  exit: Min | null;
  expected: Min | null;
  /** وقت الانصراف الآمن للعرض: لو دخولك 8:14:37 فانصرافك 3:15 (مو 3:14) عشان ما ينحسب عليك جزء دقيقة */
  expectedSafe: Min | null;
  late: number;
  early: number;
  raw: number;     // التأخير + الخروج المبكر
  credit: number;  // استئذان جزئي انقبل
  used: number;    // ما ينحسب من رصيدك
  provisional: boolean;
}

export function calcDay(date: string, rec: DayRecord | undefined, s: Settings, today: string): DayCalc {
  const base: DayCalc = { date, status: 'none', enter: null, exit: null, expected: null, expectedSafe: null, late: 0, early: 0, raw: 0, credit: 0, used: 0, provisional: false };
  if (!isWorkday(date, s)) return { ...base, status: 'off' };
  if (rec?.kind && rec.kind !== 'work') return { ...base, status: 'blocked' };
  const sc = scheduleFor(date, s);
  const enter = toMin(rec?.enter), exit = toMin(rec?.exit);
  const provisional = [rec?.enterSource, rec?.exitSource].some((x) => x === 'success' || x === 'open');
  if (enter == null) {
    if (date > today) return { ...base, status: 'future' };
    return { ...base, status: date < today ? 'absent' : 'none' };
  }
  const expected = expectedExit(enter, sc);
  const expectedSafe = expected + (secOf(rec?.enter) > 0 && enter > sc.flexStart && enter < sc.flexEnd ? 1 : 0);
  const late = lateOf(enter, sc);
  if (exit == null) {
    return { ...base, status: date < today ? 'missingExit' : 'open', enter, expected, expectedSafe, late, raw: late, used: 0, provisional };
  }
  const early = Math.max(0, expected - exit);
  const raw = late + early;
  const credit = rec?.excuseState === 'approved' ? Math.min(raw, Math.max(0, rec.excuseMinutes ?? 0)) : 0;
  return { ...base, status: 'complete', enter, exit, expected, expectedSafe, late, early, raw, credit, used: raw - credit, provisional };
}

/** لون النقطة في التقويم (نفس دلالات حاضر+) */
export type Dot = 'present' | 'short' | 'rest' | 'absent' | 'leave' | 'excuse' | 'external' | 'open' | 'none';
export function dotOf(c: DayCalc, rec?: DayRecord): Dot {
  switch (c.status) {
    case 'off': return 'rest';
    case 'blocked':
      return rec?.kind === 'leave' ? 'leave' : rec?.kind === 'excuse' ? 'excuse'
        : rec?.kind === 'holiday' ? 'rest' : 'external';
    case 'absent': return 'absent';
    case 'missingExit': return 'short';
    case 'open': return 'open';
    case 'complete': return c.raw === 0 ? 'present' : c.used === 0 ? 'excuse' : 'short';
    default: return 'none';
  }
}

// ---------- الشهر ----------
export interface MonthCalc {
  month: string;
  days: DayCalc[];
  used: number;          // المستهلك (أيام مكتملة)
  remaining: number;     // allowance - used (سالب = تجاوز)
  todayLate: number;     // تأخير اليوم الجاري (لسا ما انحسب)
  remainingWorkdays: string[]; // أيام دوام باقية (اليوم مضمّن لو ما خلص)
  todayShare: number;    // المسموح اليوم = المتبقي ÷ الأيام الباقية
  missing: string[];     // أيام فاتت بلا بيانات كاملة
  completeCount: number;
  avg: number;           // متوسط الاستهلاك اليومي
  projected: number;     // المتوقع نهاية الشهر بنفس المعدل
  exceedDate: string | null; // متى بتتجاوز بنفس المعدل
  approvedCredit: number;    // مجموع الاستئذانات الجزئية المقبولة
}

export function calcMonth(month: string, records: Record<string, DayRecord>, s: Settings, today: string): MonthCalc {
  const days = monthDays(month).map((d) => calcDay(d, records[d], s, today));
  let used = 0, completeCount = 0, approvedCredit = 0, todayLate = 0;
  const missing: string[] = [];
  const remainingWorkdays: string[] = [];
  for (const c of days) {
    if (c.status === 'complete') { used += c.used; completeCount++; approvedCredit += c.credit; }
    if (c.status === 'absent' || c.status === 'missingExit') missing.push(c.date);
    if (c.date === today && c.status === 'open') todayLate = c.late;
    if (c.date >= today && (c.status === 'future' || c.status === 'none' || c.status === 'open')) remainingWorkdays.push(c.date);
  }
  const remaining = s.allowance - used;
  const todayShare = remainingWorkdays.length ? Math.floor(Math.max(0, remaining) / remainingWorkdays.length) : 0;
  const avg = completeCount ? used / completeCount : 0;
  const projected = Math.round(used + avg * remainingWorkdays.length);
  let exceedDate: string | null = null;
  if (completeCount >= 2 && avg > 0 && remaining > 0) {
    const n = Math.floor(remaining / avg);
    if (n < remainingWorkdays.length) exceedDate = remainingWorkdays[n] ?? null;
  }
  return { month, days, used, remaining, todayLate, remainingWorkdays, todayShare, missing, completeCount, avg, projected, exceedDate, approvedCredit };
}

// ---------- اليوم الحالي ----------
export interface TodayCalc {
  day: DayCalc;
  schedule: Schedule;
  ramadan: boolean;
  /** أبكر وقت تطلع فيه وتبقى على خطة الشهر (من المسموح اليوم) */
  allowedExit: Min | null;
  /** لو طلعت الحين: كم ينخصم اليوم، وكم يبقى من رصيدك */
  leaveNow: { cost: number; after: number } | null;
  /** آخر وقت دخول بدون تأخير */
  flexEnd: Min;
}

export function calcToday(m: MonthCalc, records: Record<string, DayRecord>, s: Settings, now: { date: string; min: Min }): TodayCalc {
  const day = m.days.find((d) => d.date === now.date) ?? calcDay(now.date, records[now.date], s, now.date);
  const sc = scheduleFor(now.date, s);
  let allowedExit: Min | null = null;
  let leaveNow: TodayCalc['leaveNow'] = null;
  if (day.status === 'open' && day.enter != null && day.expectedSafe != null) {
    allowedExit = Math.max(day.enter, day.expectedSafe - Math.max(0, m.todayShare - day.late));
    const cost = day.late + Math.max(0, day.expectedSafe - now.min);
    leaveNow = { cost, after: m.remaining - cost };
  }
  return { day, schedule: sc, ramadan: isRamadan(now.date, s), allowedExit, leaveNow, flexEnd: sc.flexEnd };
}

// ---------- خطة المعالجة ----------
export interface PlanItem { date: string; minutes: number; dayUsed: number }
export interface Plan {
  over: number;          // كم تجاوزت الحد (0 = تحت الحد)
  items: PlanItem[];     // الأيام المقترحة للاستئذان، من الأعلى
  after: number;         // مجموعك بعد قبولها
  poolLeft: number | null; // المتبقي من رصيد المدير بعدها
  submitted: PlanItem[]; // طلبات مرفوعة ولسا ما انقبلت
}

/**
 * أقل عدد أيام تقدم عليها استئذان عشان تنزل تحت الحد.
 * target: الحد اللي تبي تنزل تحته (افتراضياً allowance نفسه).
 * يطلب لكل يوم استهلاكه كامل (هذا اللي ينشال لما ينقبل الطلب).
 */
export function remediation(m: MonthCalc, records: Record<string, DayRecord>, s: Settings, target = s.allowance): Plan {
  const submitted: PlanItem[] = m.days
    .filter((d) => d.status === 'complete' && records[d.date]?.excuseState === 'submitted')
    .map((d) => ({ date: d.date, minutes: Math.min(d.raw, records[d.date]?.excuseMinutes ?? d.raw), dayUsed: d.used }));
  const pendingCredit = submitted.reduce((a, x) => a + x.minutes, 0);
  const over = Math.max(0, m.used - pendingCredit - target);
  const items: PlanItem[] = [];
  if (over > 0) {
    const candidates = m.days
      .filter((d) => d.status === 'complete' && d.used > 0 && !records[d.date]?.excuseState)
      .sort((a, b) => b.used - a.used || a.date.localeCompare(b.date));
    // أقل عدد أيام: نأخذ الأعلى لين نغطي التجاوز، وبعدين نشوف هل يوم واحد أصغر يكفي بدل آخر يوم مختار
    let need = over;
    for (const d of candidates) {
      if (need <= 0) break;
      items.push({ date: d.date, minutes: d.used, dayUsed: d.used });
      need -= d.used;
    }
    if (items.length > 0 && need <= 0) {
      const covered = items.slice(0, -1).reduce((a, x) => a + x.minutes, 0);
      const rest = over - covered;
      const chosen = new Set(items.map((x) => x.date));
      const smaller = candidates.filter((d) => !chosen.has(d.date) && d.used >= rest).sort((a, b) => a.used - b.used)[0];
      const last = items[items.length - 1]!;
      if (smaller && smaller.used < last.minutes) items[items.length - 1] = { date: smaller.date, minutes: smaller.used, dayUsed: smaller.used };
    }
  }
  const planned = items.reduce((a, x) => a + x.minutes, 0);
  const pool = s.managerPool ?? null;
  const poolLeft = pool == null ? null : pool - m.approvedCredit - pendingCredit - planned;
  return { over, items, after: m.used - pendingCredit - planned, poolLeft, submitted };
}
