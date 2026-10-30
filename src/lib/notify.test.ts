import { describe, expect, it } from 'vitest';
import { dueNotices } from './notify';
import { DEFAULT_SETTINGS as S, type DayRecord } from './rules';

const day = '2026-11-11'; // أربعاء
const keys = (records: Record<string, DayRecord>, min: number, s = S) => dueNotices({ records, settings: s, now: { date: day, min } }).map((n) => n.key.split('-')[0]);

describe('الإشعارات', () => {
  it('ما بصمت بعد 8:05، والمرونة 8:45', () => {
    expect(keys({}, 8 * 60 + 5)).toContain('notyet');
    expect(keys({}, 8 * 60 + 45)).toContain('flex');
    expect(keys({}, 7 * 60)).not.toContain('notyet');
  });
  it('لا تذكير في يوم استئذان', () => {
    expect(keys({ [day]: { date: day, kind: 'excuse' } }, 8 * 60 + 5)).not.toContain('notyet');
  });
  it('بعد الحضور: إشعار الحضور، منتصف الدوام، قبل الانصراف، وقته، ونسيان البصمة', () => {
    const r = { [day]: { date: day, enter: '08:14', enterSource: 'hadir' } as DayRecord };
    expect(keys(r, 8 * 60 + 15)).toContain('in');
    expect(keys(r, 11 * 60 + 44)).toContain('half');
    expect(keys(r, 14 * 60 + 59)).toContain('pre');
    expect(keys(r, 15 * 60 + 14)).toContain('exitnow');
    expect(keys(r, 15 * 60 + 40)).toContain('exitdue');
  });
  it('الثواني تؤخر وقت الانصراف دقيقة', () => {
    const r = { [day]: { date: day, enter: '08:14:37', enterSource: 'last' } as DayRecord };
    expect(keys(r, 15 * 60 + 14)).not.toContain('exitnow');
    expect(keys(r, 15 * 60 + 15)).toContain('exitnow');
  });
  it('الانصراف والخصم', () => {
    const r = { [day]: { date: day, enter: '08:14', exit: '15:05', enterSource: 'hadir', exitSource: 'hadir' } as DayRecord };
    const n = dueNotices({ records: r, settings: S, now: { date: day, min: 15 * 60 + 6 } }).find((x) => x.key.startsWith('out'));
    expect(n?.title).toContain('خصم 9 د');
  });
  it('إيقاف نوع من الإعدادات', () => {
    expect(keys({}, 8 * 60 + 5, { ...S, notify: { ...S.notify, remind: false } })).not.toContain('notyet');
  });
  it('تنبيه مخصص بوقته في أيام العمل', () => {
    const s = { ...S, customAlerts: [{ id: 'x', time: '14:45', text: 'تقرير', days: 'work' as const, on: true }] };
    expect(keys({}, 14 * 60 + 45, s)).toContain('ca');
  });
});
