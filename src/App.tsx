import { lazy, Suspense, useEffect, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router';
import { CalendarDots, ChartDonut, GearSix, SunHorizon, type Icon } from '@phosphor-icons/react';
import type { Session } from '@supabase/supabase-js';
import { DEMO, supabase } from './lib/data';
import { Spinner, cx } from './components/ui';
import Today from './pages/Today';
import Login from './pages/Login';

const Log = lazy(() => import('./pages/Log'));
const Balance = lazy(() => import('./pages/Balance'));
const More = lazy(() => import('./pages/More'));

const TABS: { to: string; label: string; icon: Icon }[] = [
  { to: '/', label: 'اليوم', icon: SunHorizon },
  { to: '/log', label: 'السجل', icon: CalendarDots },
  { to: '/balance', label: 'الرصيد', icon: ChartDonut },
  { to: '/more', label: 'الإعدادات', icon: GearSix },
];

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(DEMO ? null : undefined);
  useEffect(() => {
    if (DEMO) return;
    supabase!.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase!.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!DEMO && session === undefined) return <Spinner />;
  if (!DEMO && !session) return <Login />;

  return (
    <>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/log" element={<Log />} />
          <Route path="/balance" element={<Balance />} />
          <Route path="/more" element={<More />} />
          <Route path="*" element={<Today />} />
        </Routes>
      </Suspense>
      <TabBar />
    </>
  );
}

function TabBar() {
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 px-4">
      <div className="mx-auto mb-1 grid max-w-md grid-cols-4 rounded-[26px] border border-white/40 bg-surface/80 p-1.5 shadow-[0_8px_30px_rgba(5,36,31,.16)] backdrop-blur-2xl dark:border-white/5">
        {TABS.map(({ to, label, icon: I }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) => cx('flex flex-col items-center gap-0.5 rounded-[20px] py-1.5 text-[11px] font-semibold transition', isActive ? 'bg-brand-soft text-brand' : 'text-muted')}>
            {({ isActive }) => (<><I className="size-[25px]" weight={isActive ? 'fill' : 'regular'} />{label}</>)}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
