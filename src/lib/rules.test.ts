import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS as S, calcDay, calcMonth, calcToday, expectedExit, NORMAL, remediation, hijriMonth, nextRamadanStart,
  riyadhNow, weekday, type DayRecord,
} from './rules';

const rec = (date: string, enter?: string, exit?: string, extra: Partial<DayRecord> = {}): DayRecord => ({ date, enter, exit, ...extra });

describe('وقت الخروج المطلوب (نفس «أعمالي»)', () => {
  it('قبل 8 = 3:00 ثابت', () => {
    expect(expectedExit(7 * 60, NORMAL)).toBe(900);
    expect(expectedExit(480, NORMAL)).toBe(900);
  });
  it('بين 8 و9 = الدخول + 7 ساعات', () => {
    expect(expectedExit(8 * 60 + 20, NORMAL)).toBe(15 * 60 + 20);
    expect(expectedExit(540, NORMAL)).toBe(960);
  });
  it('بعد 9 = 4:00', () => {
    expect(expectedExit(9 * 60 + 30, NORMAL)).toBe(960);
  });
});

describe('استهلاك اليوم', () => {
  const today = '2026-11-30';
  it('8:20 → 3:05 = 15 د', () => {
    const d = calcDay('2026-11-02', rec('2026-11-02', '08:20', '15:05'), S, today);
    expect(d.used).toBe(15);
    expect(d.early).toBe(15);
  });
  it('9:30 → 4:00 = تأخير 30 بس، وما يعوضه البقاء بعد 4', () => {
    expect(calcDay('2026-11-02', rec('2026-11-02', '09:30', '16:00'), S, today).used).toBe(30);
    expect(calcDay('2026-11-02', rec('2026-11-02', '09:30', '16:45'), S, today).used).toBe(30);
  });
  it('7:40 → 2:50 = 10 د (الخروج ما يصير قبل 3)', () => {
    expect(calcDay('2026-11-02', rec('2026-11-02', '07:40', '14:50'), S, today).used).toBe(10);
  });
  it('استئذان جزئي مقبول ينشال، ومرفوع بس ما ينشال', () => {
    expect(calcDay('2026-11-02', rec('2026-11-02', '08:00', '13:00', { excuseMinutes: 90, excuseState: 'approved' }), S, today).used).toBe(30);
    expect(calcDay('2026-11-02', rec('2026-11-02', '08:00', '13:00', { excuseMinutes: 90, excuseState: 'submitted' }), S, today).used).toBe(120);
  });
  it('يوم كامل محجوب = صفر، والجمعة خارج الحساب', () => {
    expect(calcDay('2026-11-02', rec('2026-11-02', undefined, undefined, { kind: 'external' }), S, today).status).toBe('blocked');
    expect(weekday('2026-11-06')).toBe(5);
    expect(calcDay('2026-11-06', undefined, S, today).status).toBe('off');
  });
});

describe('الشهر', () => {
  const records: Record<string, DayRecord> = {
    '2026-11-01': rec('2026-11-01', '08:05', '15:05'),          // 0
    '2026-11-02': rec('2026-11-02', '08:30', '15:00'),          // 30
    '2026-11-03': rec('2026-11-03', '09:20', '16:00'),          // 20
    '2026-11-04': rec('2026-11-04', '08:10', undefined),        // open (today)
  };
  const m = calcMonth('2026-11', records, S, '2026-11-04');
  it('المستهلك والمتبقي', () => {
    expect(m.used).toBe(50);
    expect(m.remaining).toBe(369);
    expect(m.completeCount).toBe(3);
  });
  it('الأيام الباقية تشمل اليوم المفتوح، والمسموح اليوم = المتبقي ÷ الأيام', () => {
    expect(m.remainingWorkdays[0]).toBe('2026-11-04');
    // نوفمبر 2026: أيام الدوام من 4 لين 30 = 19
    expect(m.remainingWorkdays.length).toBe(19);
    expect(m.todayShare).toBe(Math.floor(369 / 19));
  });
  it('اليوم: وقت الخروج المسموح ولو طلعت الحين', () => {
    const t = calcToday(m, records, S, { date: '2026-11-04', min: 14 * 60 + 40 });
    expect(t.day.expected).toBe(15 * 60 + 10);
    expect(t.allowedExit).toBe(15 * 60 + 10 - m.todayShare);
    expect(t.leaveNow).toEqual({ cost: 30, after: 339 });
  });
});

describe('خطة المعالجة', () => {
  it('يختار أقل عدد أيام من الأعلى ويستبدل الأخير بأصغر يوم يكفي', () => {
    const r: Record<string, DayRecord> = {
      '2026-11-01': rec('2026-11-01', '08:00', '12:00'), // 180
      '2026-11-02': rec('2026-11-02', '08:00', '13:00'), // 120
      '2026-11-03': rec('2026-11-03', '08:00', '14:00'), // 60
      '2026-11-04': rec('2026-11-04', '08:00', '14:00'), // 60
      '2026-11-05': rec('2026-11-05', '08:00', '14:10'), // 50
    };
    const m = calcMonth('2026-11', r, S, '2026-11-08'); // 470 → تجاوز 51
    const p = remediation(m, r, S);
    expect(m.used).toBe(470);
    expect(p.over).toBe(51);
    expect(p.items).toEqual([{ date: '2026-11-03', minutes: 60, dayUsed: 60 }]);
    expect(p.after).toBe(410);
  });
  it('الطلب المرفوع ينحسب قبل اقتراح جديد', () => {
    const r: Record<string, DayRecord> = {
      '2026-11-01': rec('2026-11-01', '08:00', '12:00', { excuseState: 'submitted', excuseMinutes: 180 }),
      '2026-11-02': rec('2026-11-02', '08:00', '11:00'), // 240
      '2026-11-03': rec('2026-11-03', '08:00', '14:00'), // 60
    };
    const m = calcMonth('2026-11', r, S, '2026-11-08'); // 480
    const p = remediation(m, r, S);
    expect(p.over).toBe(0);
    expect(p.submitted.length).toBe(1);
  });
});

describe('رمضان والتوقيت', () => {
  it('أم القرى: رمضان 1448 حوالي فبراير 2027', () => {
    const start = nextRamadanStart('2026-11-01', S)!;
    expect(start.startsWith('2027-02')).toBe(true);
    expect(hijriMonth(start)).toBe(9);
  });
  it('توقيت الرياض', () => {
    expect(riyadhNow(new Date('2026-10-30T21:30:00Z'))).toEqual({ date: '2026-10-31', min: 30 });
  });
});
