import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Drawer } from 'vaul';
import { CaretLeft, CircleNotch, type Icon } from '@phosphor-icons/react';
import { hm } from '../lib/rules';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/** صفحة بعنوان كبير مثل تطبيقات الآيفون */
export function Page({ title, subtitle, action, children }: { title: string; subtitle?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-32 pt-safe">
      <header className="flex items-end justify-between gap-3 pb-4 pt-3">
        <div className="min-w-0">
          {subtitle && <div className="mb-0.5 text-[13px] font-semibold text-muted">{subtitle}</div>}
          <h1 className="text-[32px] font-bold leading-tight tracking-tight">{title}</h1>
        </div>
        {action}
      </header>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

export function Card({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={cx('block w-full rounded-card bg-surface p-4 text-right shadow-[0_1px_2px_rgba(0,0,0,.04)]', onClick && 'transition active:scale-[.985]', className)}>
      {children}
    </Tag>
  );
}

/** قائمة مجمّعة (Inset Grouped) */
export function Group({ header, footer, children }: { header?: ReactNode; footer?: ReactNode; children: ReactNode }) {
  return (
    <section>
      {header && <h2 className="mb-1.5 px-4 text-[13px] font-semibold text-muted">{header}</h2>}
      <div className="divide-y divide-line overflow-hidden rounded-card bg-surface">{children}</div>
      {footer && <p className="mt-1.5 px-4 text-[12.5px] leading-relaxed text-muted">{footer}</p>}
    </section>
  );
}

export function Row({ icon: I, tint = 'bg-brand', label, hint, value, onClick, chevron, children, danger }: {
  icon?: Icon; tint?: string; label: ReactNode; hint?: ReactNode; value?: ReactNode; onClick?: () => void; chevron?: boolean; children?: ReactNode; danger?: boolean;
}) {
  const body = (
    <>
      {I && <span className={cx('flex size-8 shrink-0 items-center justify-center rounded-[9px] text-white', tint)}><I className="size-[18px]" weight="fill" /></span>}
      <span className="min-w-0 flex-1">
        <span className={cx('block text-[16px]', danger && 'text-danger')}>{label}</span>
        {hint && <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{hint}</span>}
      </span>
      {value != null && <span className="shrink-0 text-[15px] text-muted">{value}</span>}
      {children}
      {chevron && <CaretLeft className="size-4 shrink-0 text-faint" weight="bold" />}
    </>
  );
  const cls = 'flex min-h-[52px] w-full items-center gap-3 px-4 py-2.5 text-right';
  return onClick
    ? <button type="button" onClick={onClick} className={cx(cls, 'transition active:bg-surface-2')}>{body}</button>
    : <div className={cls}>{body}</div>;
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'white';
const variants: Record<Variant, string> = {
  primary: 'bg-brand text-brand-ink',
  secondary: 'bg-surface-2 text-ink',
  ghost: 'text-brand',
  danger: 'bg-danger-soft text-danger',
  white: 'bg-white text-[#0C5A4A]',
};
export function Button({ variant = 'primary', loading, className, children, disabled, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button {...rest} disabled={disabled || loading}
      className={cx('inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-[16px] font-semibold transition active:scale-[.97] disabled:opacity-50', variants[variant], className)}>
      {loading && <CircleNotch className="size-4 animate-spin" weight="bold" />}
      {children}
    </button>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={cx('relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors', checked ? 'bg-good' : 'bg-line')}>
      <span className={cx('absolute top-[2px] size-[27px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,.18)] transition-all', checked ? 'left-[2px]' : 'left-[22px]')} />
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-[10px] bg-surface-2 p-0.5">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={cx('h-8 flex-1 rounded-[8px] px-2 text-[13px] font-semibold transition', value === o.value ? 'bg-surface text-ink shadow-[0_1px_3px_rgba(0,0,0,.12)]' : 'text-muted')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** لوحة سفلية مثل الآيفون */
export function Sheet({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; children: ReactNode }) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} direction="bottom">
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/35" />
        <Drawer.Content dir="rtl" className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] max-w-lg flex-col rounded-t-[28px] bg-bg outline-none">
          <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-line" />
          <Drawer.Title className="px-5 pb-2 pt-3 text-center text-[17px] font-bold">{title}</Drawer.Title>
          <Drawer.Description className="sr-only">{title}</Drawer.Description>
          <div className="pb-safe overflow-y-auto px-4 pb-6">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/** حلقة تقدم */
export function Ring({ value, size = 200, stroke = 14, color = '#fff', track, children }: {
  value: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode;
}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className={track ? undefined : 'ring-track'} stroke={track} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke={color} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v)} className="ring-bar" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

export function Bar({ value, className, tone = 'bg-brand' }: { value: number; className?: string; tone?: string }) {
  return (
    <div className={cx('h-2 overflow-hidden rounded-full bg-surface-2', className)}>
      <div className={cx('h-full rounded-full transition-all duration-700', tone)} style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
    </div>
  );
}

export function Pill({ tone = 'neutral', children }: { tone?: 'neutral' | 'good' | 'warn' | 'danger' | 'brand' | 'sky' | 'violet'; children: ReactNode }) {
  const t = { neutral: 'bg-surface-2 text-muted', good: 'bg-good-soft text-good', warn: 'bg-warn-soft text-warn', danger: 'bg-danger-soft text-danger', brand: 'bg-brand-soft text-brand', sky: 'bg-sky-soft text-sky', violet: 'bg-violet-soft text-violet' }[tone];
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold', t)}>{children}</span>;
}

export function Spinner() {
  return <div className="flex justify-center py-16"><CircleNotch className="size-7 animate-spin text-brand" weight="bold" /></div>;
}

/** وقت مكتوب بخط كبير مع ص/م صغيرة */
export function Time({ t, ap, className }: { t: string; ap: string; className?: string }) {
  return <span className={cx('num inline-flex items-baseline gap-1', className)}><span className="ltr">{t}</span><span className="text-[.5em] font-semibold opacity-80">{ap}</span></span>;
}

/** رصيد الشهر: المتبقي (أخضر، يمين) والمستهلك (ذهبي، يسار) بنفس ترتيب العناوين */
export function BalanceBar({ used, allowance, className }: { used: number; allowance: number; className?: string }) {
  const over = used > allowance;
  const usedPct = Math.min(100, (used / allowance) * 100);
  return (
    <div className={className}>
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-[12px] text-muted"><span className={cx('size-2 rounded-full', over ? 'bg-danger' : 'bg-brand')} />{over ? 'التجاوز' : 'المتبقي'}</div>
          <div className={cx('num ltr text-[30px] font-bold leading-tight', over ? 'text-danger' : 'text-brand')}>{hm(Math.abs(allowance - used))}</div>
        </div>
        <div className="text-left">
          <div className="flex items-center justify-end gap-1.5 text-[12px] text-muted"><span className="size-2 rounded-full bg-gold" />المستهلك</div>
          <div className="num ltr text-[20px] font-bold leading-tight text-gold">{hm(used)}</div>
        </div>
      </div>
      <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-surface-2">
        {over ? <div className="h-full w-full bg-danger" /> : (
          <>
            <div className="h-full bg-brand transition-all duration-700" style={{ width: `${100 - usedPct}%` }} />
            <div className="h-full bg-gold transition-all duration-700" style={{ width: `${usedPct}%` }} />
          </>
        )}
      </div>
      <div className="mt-1 flex justify-between text-[11.5px] text-muted">
        <span>السماح الشهري <span className="num ltr">{hm(allowance)}</span></span>
        <span className="num">{Math.round(usedPct)}٪ مستهلك</span>
      </div>
    </div>
  );
}
