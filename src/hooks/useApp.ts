import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { deleteDay, loadProfile, loadRecords, nowRiyadh, saveDay, saveSettings } from '../lib/data';
import { addDays, calcMonth, calcToday, monthOf, type DayRecord, type Settings } from '../lib/rules';

/** الساعة: تتحدث كل 20 ثانية وكل ما رجعت للتطبيق */
export function useNow() {
  const [now, setNow] = useState(nowRiyadh);
  useEffect(() => {
    const tick = () => setNow(nowRiyadh());
    const id = setInterval(tick, 20_000);
    const vis = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', vis); };
  }, []);
  return now;
}

export function useProfile() {
  return useQuery({ queryKey: ['profile'], queryFn: loadProfile, staleTime: 5 * 60_000 });
}

/** سجل آخر ٧٠ يوم + الشهر المعروض (يكفي للشهر الحالي والأفكار) */
export function useRecords(month?: string) {
  const now = useNow();
  const from = month && month < monthOf(addDays(now.date, -70)) ? `${month}-01` : addDays(now.date, -70);
  const to = month && month > monthOf(now.date) ? `${month}-31` : `${monthOf(now.date)}-31`;
  return useQuery({ queryKey: ['records', from, to], queryFn: () => loadRecords(from, to), refetchInterval: 60_000, refetchOnWindowFocus: true });
}

export function useApp() {
  const now = useNow();
  const profile = useProfile();
  const records = useRecords();
  const settings = profile.data?.settings;
  const recs = useMemo(() => records.data ?? {}, [records.data]);
  const month = useMemo(() => (settings ? calcMonth(monthOf(now.date), recs, settings, now.date) : null), [settings, recs, now.date]);
  const today = useMemo(() => (settings && month ? calcToday(month, recs, settings, now) : null), [settings, month, recs, now]);
  return { now, settings, token: profile.data?.token, records: recs, month, today, loading: profile.isLoading || records.isLoading, error: profile.error || records.error };
}

export function useSaveDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (r: DayRecord) => saveDay(r),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['records'] }),
    onError: () => toast.error('ما انحفظ. تأكد من الاتصال وجرّب مرة ثانية'),
  });
}
export function useDeleteDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (date: string) => deleteDay(date),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['records'] }),
  });
}
export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: Settings) => saveSettings(s),
    onMutate: async (s) => {
      const prev = qc.getQueryData<{ settings: Settings; token: string }>(['profile']);
      if (prev) qc.setQueryData(['profile'], { ...prev, settings: s });
      return { prev };
    },
    onError: (_e, _s, ctx) => { if (ctx?.prev) qc.setQueryData(['profile'], ctx.prev); toast.error('ما انحفظ الإعداد'); },
    onSettled: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  });
}
