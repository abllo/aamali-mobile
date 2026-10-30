import { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle, HandPalm, ShieldCheck, Warning } from '@phosphor-icons/react';
import { useApp, useSaveDay } from '../hooks/useApp';
import { DaySheet } from '../components/DaySheet';
import { BalanceBar, Button, Card, Group, Page, Pill, Row, Spinner, cx } from '../components/ui';
import { indicators, recentDays } from '../lib/insights';
import { dayName, monthName } from '../lib/notify';
import { dur, hm, monthOf, remediation, weekday, type PlanItem } from '../lib/rules';

const WD = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];

export default function Balance() {
  const { now, settings, records, month } = useApp();
  const save = useSaveDay();
  const [edit, setEdit] = useState<string | null>(null);
  if (!settings || !month) return <Spinner />;

  const plan = remediation(month, records, settings);
  const backup = plan.items.length === 0 && month.projected > settings.allowance
    ? remediation(month, records, settings, Math.max(0, settings.allowance - (month.projected - month.used))) : null;
  const recent = recentDays(records, settings, now.date, 70);
  const byDay = [0, 1, 2, 3, 4].map((w) => {
    const xs = recent.filter((d) => weekday(d.date) === w).map((d) => d.used);
    return { w, avg: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0, n: xs.length };
  });
  const maxAvg = Math.max(10, ...byDay.map((x) => x.avg));
  const topAvg = Math.max(...byDay.map((x) => x.avg));
  const requests = month.days.filter((d) => records[d.date]?.excuseState);
  const ind = indicators(records, settings, now.date);

  const submit = (it: PlanItem) => save.mutate({ ...records[it.date]!, excuseState: 'submitted', excuseMinutes: it.minutes },
    { onSuccess: () => toast.success('تم تسجيل الطلب') });
  const approve = (date: string) => save.mutate({ ...records[date]!, excuseState: 'approved' }, { onSuccess: () => toast.success('تم اعتماد الطلب') });

  return (
    <Page title="الرصيد" subtitle={monthName(monthOf(now.date))}>
      <Card>
        <BalanceBar used={month.used} allowance={settings.allowance} />
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Mini label="المتوقع للشهر" value={hm(month.projected)} tone={month.projected > settings.allowance ? 'text-danger' : undefined} />
          <Mini label="المسموح يومياً" value={dur(month.todayShare)} />
          <Mini label="الأيام المتبقية" value={String(month.remainingWorkdays.length)} />
        </div>
      </Card>

      {plan.items.length > 0 ? (
        <Group header="خطة المعالجة" footer={`الرصيد بعد اعتماد الطلبات: ${hm(plan.after)}`}>
          <div className="flex items-center gap-2 bg-danger-soft px-4 py-3 text-[14px] font-bold text-danger"><Warning className="size-5" weight="fill" /> تجاوز الرصيد بـ {dur(plan.over)}</div>
          {plan.items.map((it) => (
            <Row key={it.date} icon={HandPalm} tint="bg-danger" label={dayName(it.date)} hint={`المدة ${dur(it.minutes)}`}>
              <Button className="h-9 rounded-xl px-3 text-[13px]" loading={save.isPending} onClick={() => submit(it)}>تم التقديم</Button>
            </Row>
          ))}
        </Group>
      ) : backup && backup.items.length > 0 ? (
        <Group header="خطة احتياطية">
          {backup.items.map((it) => <Row key={it.date} icon={HandPalm} tint="bg-gold" label={dayName(it.date)} value={dur(it.minutes)} />)}
        </Group>
      ) : (
        <Card className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-good-soft text-good"><ShieldCheck className="size-6" weight="fill" /></span>
          <b>ضمن الحد المسموح</b>
        </Card>
      )}

      {requests.length > 0 && (
        <Group header="طلبات الاستئذان" footer={settings.managerPool != null && plan.poolLeft != null ? `رصيد ساعات المدير المتبقي: ${hm(Math.max(0, plan.poolLeft))}` : undefined}>
          {requests.map((d) => {
            const st = records[d.date]!.excuseState;
            return (
              <Row key={d.date} label={dayName(d.date)} hint={dur(records[d.date]!.excuseMinutes ?? d.raw)} onClick={() => setEdit(d.date)}>
                {st === 'approved' ? <Pill tone="good"><CheckCircle className="size-3.5" weight="fill" /> معتمد</Pill>
                  : <button className="rounded-xl bg-good-soft px-3 py-1.5 text-[13px] font-bold text-good" onClick={(e) => { e.stopPropagation(); approve(d.date); }}>اعتماد</button>}
              </Row>
            );
          })}
        </Group>
      )}

      {recent.length >= 3 && (
        <Card>
          <div className="mb-3 text-[15px] font-bold">متوسط الاستهلاك اليومي <span className="text-[12px] font-normal text-muted">(دقيقة)</span></div>
          <div className="flex h-36 items-end justify-between gap-3">
            {byDay.map((x) => (
              <div key={x.w} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="num text-[12px] font-semibold text-muted">{x.n ? Math.round(x.avg) : '—'}</span>
                <div className={cx('w-full rounded-t-lg', x.avg === topAvg && x.avg > 0 ? 'bg-gold' : 'bg-brand/70')} style={{ height: `${Math.max(4, (x.avg / maxAvg) * 96)}px` }} />
                <span className="text-[11.5px] text-muted">{WD[x.w]}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {ind.length > 0 && (
        <Group header="المؤشرات">
          {ind.map((i) => <Row key={i.id} label={i.label} value={<b className={cx('text-ink', i.tone === 'warn' && 'text-warn', i.tone === 'good' && 'text-good')}>{i.value}</b>} />)}
        </Group>
      )}
      {edit && <DaySheet date={edit} onClose={() => setEdit(null)} />}
    </Page>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-1 py-2">
      <div className={cx('num text-[17px] font-bold', tone)}>{value}</div>
      <div className="text-[11.5px] text-muted">{label}</div>
    </div>
  );
}
