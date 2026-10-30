import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { AirplaneTilt, Briefcase, Fingerprint, GraduationCap, HandPalm, House, SunHorizon } from '@phosphor-icons/react';
import { useNow, useSaveDay } from '../hooks/useApp';
import { dayName } from '../lib/notify';
import { KIND_LABEL, type DayKind } from '../lib/rules';
import { Button, Group, Row, Sheet } from './ui';

const OPTIONS: { kind: DayKind; icon: typeof HandPalm; tint: string }[] = [
  { kind: 'excuse', icon: HandPalm, tint: 'bg-sky' },
  { kind: 'leave', icon: AirplaneTilt, tint: 'bg-[#3B6FD8]' },
  { kind: 'remote', icon: House, tint: 'bg-brand' },
  { kind: 'external', icon: Briefcase, tint: 'bg-violet' },
  { kind: 'training', icon: GraduationCap, tint: 'bg-violet' },
  { kind: 'holiday', icon: SunHorizon, tint: 'bg-faint' },
];

/** حالة اليوم — تفتح من إشعار «لم تُسجَّل بصمة الحضور» أو من الرئيسية */
export function AskSheet({ open, onOpenChange, date }: { open: boolean; onOpenChange: (o: boolean) => void; date?: string }) {
  const now = useNow();
  const d = date ?? now.date;
  const save = useSaveDay();
  const [manual, setManual] = useState(false);
  const [enter, setEnter] = useState('08:00');
  useEffect(() => { if (!open) setManual(false); }, [open]);

  const pick = (kind: DayKind) => save.mutate({ date: d, kind, enter: null, exit: null }, {
    onSuccess: () => { toast.success(`تم التسجيل: ${KIND_LABEL[kind]}`); onOpenChange(false); },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="حالة اليوم">
      <p className="mb-4 text-center text-[13.5px] text-muted">{dayName(d)}</p>
      {!manual ? (
        <div className="space-y-5">
          <Group>
            {OPTIONS.map((o) => <Row key={o.kind} icon={o.icon} tint={o.tint} label={KIND_LABEL[o.kind]} onClick={() => pick(o.kind)} chevron />)}
          </Group>
          <Group>
            <Row icon={Fingerprint} tint="bg-good" label="إضافة بصمة يدوية" onClick={() => setManual(true)} chevron />
          </Group>
        </div>
      ) : (
        <div className="space-y-4">
          <label className="block rounded-card bg-surface p-4">
            <span className="mb-2 block text-[13px] font-semibold text-muted">وقت الحضور</span>
            <input type="time" value={enter} onChange={(e) => setEnter(e.target.value)}
              className="num h-12 w-full rounded-2xl bg-surface-2 px-4 text-center text-[22px] font-bold outline-none" />
          </label>
          <Button className="w-full" loading={save.isPending}
            onClick={() => save.mutate({ date: d, enter, enterSource: 'manual', kind: 'work' }, { onSuccess: () => { toast.success('تم تسجيل الحضور'); onOpenChange(false); } })}>
            حفظ
          </Button>
        </div>
      )}
    </Sheet>
  );
}

/** يفتح تلقائياً عند الضغط على الإشعار: ‎#/?ask=today‎ */
export function useAskFromLink(): [boolean, (o: boolean) => void] {
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (params.get('ask')) {
      setOpen(true);
      setParams((p) => { p.delete('ask'); return p; }, { replace: true });
    }
  }, [params, setParams]);
  return [open, setOpen];
}
