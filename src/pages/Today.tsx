import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, CheckCircle, Fingerprint, Moon, SignIn, SignOut, Timer, Warning } from '@phosphor-icons/react';
import { useApp } from '../hooks/useApp';
import { AskSheet, useAskFromLink } from '../components/AskSheet';
import { DaySheet } from '../components/DaySheet';
import { BalanceBar, Card, Page, Ring, Spinner, Time, cx } from '../components/ui';
import { indicators } from '../lib/insights';
import { dayName } from '../lib/notify';
import { clock, dur, durLong, hm, isWorkday, KIND_LABEL, remediation, type Min } from '../lib/rules';
import { hijriText } from '../lib/format';

export default function Today() {
  const { now, settings, records, month, today, loading } = useApp();
  const [askOpen, setAskOpen] = useAskFromLink();
  const [edit, setEdit] = useState<string | null>(null);
  if (loading || !settings || !month || !today) return <Spinner />;

  const rec = records[now.date];
  const plan = remediation(month, records, settings);
  const ind = indicators(records, settings, now.date);

  return (
    <Page title="اليوم" subtitle={<>{dayName(now.date)} · {hijriText(now.date)}</>}>
      <Hero now={now.min} t={today} kindLabel={rec?.kind ? KIND_LABEL[rec.kind] : undefined} workday={isWorkday(now.date, settings)}
        onAsk={() => setAskOpen(true)} onEdit={() => setEdit(now.date)} />

      <Card>
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-bold">رصيد الشهر</span>
          <Link to="/balance" className="flex items-center gap-1 text-[13px] font-semibold text-brand">التفاصيل <ArrowLeft className="size-3.5" weight="bold" /></Link>
        </div>
        <BalanceBar className="mt-3" used={month.used} allowance={settings.allowance} />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Stat label="المسموح يومياً" value={dur(month.todayShare)} />
          <Stat label="أيام العمل المتبقية" value={String(month.remainingWorkdays.length)} />
        </div>
        {month.exceedDate && (
          <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-warn-soft px-3 py-2 text-[13px] font-semibold text-warn">
            <Warning className="size-4 shrink-0" weight="fill" /> يُتوقع تجاوز الرصيد قبل {dayName(month.exceedDate)}
          </p>
        )}
      </Card>

      {plan.items.length > 0 && (
        <Card className="bg-danger-soft">
          <Link to="/balance" className="block">
            <div className="flex items-center gap-2 font-bold text-danger"><Warning className="size-5" weight="fill" /> تجاوز الرصيد بـ {dur(plan.over)}</div>
            <p className="mt-1 text-[14px]">يُقترح استئذان {dayName(plan.items[0]!.date)} ({dur(plan.items[0]!.minutes)}){plan.items.length > 1 && ` و${plan.items.length - 1} يوم آخر`}</p>
          </Link>
        </Card>
      )}

      {month.missing.length > 0 && (
        <Card onClick={() => setEdit(month.missing[0]!)} className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-warn-soft text-warn"><Warning className="size-5" weight="fill" /></span>
          <span className="flex-1">
            <span className="block font-semibold">أيام غير مكتملة: {month.missing.length}</span>
            <span className="block text-[13px] text-muted">{dayName(month.missing[0]!)}</span>
          </span>
          <ArrowLeft className="size-4 text-faint" weight="bold" />
        </Card>
      )}

      {ind.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-[15px] font-bold">المؤشرات</h2>
          <div className="grid grid-cols-2 gap-2">
            {ind.map((i) => (
              <div key={i.id} className="rounded-2xl bg-surface px-3.5 py-3">
                <div className="text-[12px] text-muted">{i.label}</div>
                <div className={cx('mt-0.5 text-[16px] font-bold', i.tone === 'warn' && 'text-warn', i.tone === 'good' && 'text-good')}>{i.value}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <AskSheet open={askOpen} onOpenChange={setAskOpen} />
      {edit && <DaySheet date={edit} onClose={() => setEdit(null)} />}
    </Page>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2">
      <div className="text-[12px] text-muted">{label}</div>
      <div className="num text-[17px] font-bold">{value}</div>
    </div>
  );
}

function Hero({ now, t, kindLabel, workday, onAsk, onEdit }: {
  now: Min; t: NonNullable<ReturnType<typeof useApp>['today']>; kindLabel?: string; workday: boolean; onAsk: () => void; onEdit: () => void;
}) {
  const d = t.day;
  const exp = d.expectedSafe;
  let ring = 0;
  let color = '#D9B662';
  let center: React.ReactNode;

  if (d.status === 'open' && d.enter != null && exp != null) {
    ring = (now - d.enter) / Math.max(1, exp - d.enter);
    const left = exp - now;
    center = left > 0 ? (
      <>
        <span className="text-[13px] opacity-80">المتبقي على الانصراف</span>
        <span className="num ltr text-[46px] font-bold leading-none tracking-tight">{hm(left)}</span>
      </>
    ) : (
      <>
        <CheckCircle className="mb-1 size-9" weight="fill" />
        <span className="text-[20px] font-bold">انتهى الدوام</span>
      </>
    );
  } else if (d.status === 'complete' && d.exit != null) {
    ring = 1; color = d.used ? '#E8A54B' : '#7BE3B5';
    center = (
      <>
        <span className="text-[13px] opacity-80">تم الانصراف</span>
        <span className="mt-1 rounded-full bg-white/15 px-3 py-0.5 text-[15px] font-bold">{d.used ? `خصم ${dur(d.used)}` : 'دون خصم'}</span>
      </>
    );
  } else if (d.status === 'blocked' || !workday) {
    center = (
      <>
        <Moon className="mb-1 size-9 opacity-90" weight="fill" />
        <span className="text-[22px] font-bold">{kindLabel ?? 'راحة'}</span>
      </>
    );
  } else {
    const toFlex = t.flexEnd - now;
    center = toFlex > 0 ? (
      <>
        <span className="text-[13px] opacity-80">لم تُسجَّل بصمة الحضور</span>
        <span className="num ltr text-[46px] font-bold leading-none">{hm(toFlex)}</span>
        <span className="mt-1 text-[13px] opacity-80">حتى نهاية المرونة</span>
      </>
    ) : (
      <>
        <span className="text-[13px] opacity-80">تأخير</span>
        <span className="num ltr text-[46px] font-bold leading-none text-[#F2C46B]">{hm(-toFlex)}</span>
      </>
    );
  }

  const open = d.status === 'open';
  const leave = t.leaveNow;
  const showAllowed = t.allowedExit != null && exp != null && t.allowedExit < exp;
  return (
    <section className="hero relative overflow-hidden rounded-[28px] p-5 shadow-[0_12px_30px_-12px_rgba(5,36,31,.6)]">
      <div className="flex justify-center pb-5 pt-1">
        <Ring value={ring} size={212} stroke={15} color={color}>{center}</Ring>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Cell icon={<SignIn className="size-4" weight="bold" />} label="الحضور" value={d.enter != null ? clock(d.enter) : null} />
        <Cell icon={<SignOut className="size-4" weight="bold" />} label="الانصراف" value={d.exit != null ? clock(d.exit) : exp != null ? clock(exp) : null} />
        <Cell icon={<Timer className="size-4" weight="bold" />} label="أبكر انصراف" value={showAllowed ? clock(t.allowedExit!) : null} />
      </div>

      {open && leave && (
        <div className={cx('mt-3 rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed', leave.after < 0 ? 'bg-[#5a1d17]/60' : 'hero-soft')}>
          {leave.cost === 0
            ? 'تسجيل الخروج في هذه اللحظة لا يخصم من رصيدك.'
            : <>تسجيل الخروج في هذه اللحظة يخصم من رصيدك <b>{durLong(leave.cost)}</b> ويصبح المتبقي: <b className="num ltr">{leave.after < 0 ? `-${hm(leave.after)}` : hm(leave.after)}</b></>}
        </div>
      )}

      {workday && d.status !== 'blocked' && d.status !== 'complete' && (
        <div className="mt-3 flex gap-2">
          {!open && <button onClick={onAsk} className="hero-soft h-11 flex-1 rounded-2xl text-[14px] font-semibold active:scale-[.98]">حالة اليوم</button>}
          <button onClick={onEdit} className="hero-soft flex h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl text-[14px] font-semibold active:scale-[.98]">
            <Fingerprint className="size-4" weight="bold" /> إضافة بصمة يدوية
          </button>
        </div>
      )}
    </section>
  );
}

function Cell({ icon, label, value }: { icon: React.ReactNode; label: string; value: { t: string; ap: string } | null }) {
  return (
    <div className="hero-soft rounded-2xl px-1 py-2.5">
      <div className="flex items-center justify-center gap-1 text-[11.5px] opacity-80">{icon}{label}</div>
      <div className="mt-0.5 text-[19px] font-bold">{value ? <Time {...value} /> : <span className="text-[15px] opacity-60">—</span>}</div>
    </div>
  );
}
