import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/data';
import { Button } from '../components/ui';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = mode === 'in'
      ? await supabase!.auth.signInWithPassword({ email, password })
      : await supabase!.auth.signUp({ email, password });
    setBusy(false);
    if (error) toast.error(error.message.includes('Invalid') ? 'البريد أو كلمة المرور غلط' : error.message);
    else if (mode === 'up') toast.success('تم إنشاء حسابك');
  }

  return (
    <div className="hero flex min-h-dvh flex-col items-center justify-center px-6">
      <img src="./logo-mark-white.png" alt="أعمالي" className="mb-10 h-24 w-auto" />
      <form onSubmit={submit} className="w-full max-w-sm space-y-3">
        <input type="email" required autoComplete="email" placeholder="البريد" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr"
          className="h-13 w-full rounded-2xl bg-white/10 px-4 py-3.5 text-[16px] text-white placeholder:text-white/50 outline-none ring-1 ring-white/15 focus:ring-[#D9B662]" />
        <input type="password" required minLength={6} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} placeholder="كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr"
          className="h-13 w-full rounded-2xl bg-white/10 px-4 py-3.5 text-[16px] text-white placeholder:text-white/50 outline-none ring-1 ring-white/15 focus:ring-[#D9B662]" />
        <Button variant="white" className="w-full" loading={busy}>{mode === 'in' ? 'دخول' : 'إنشاء حساب'}</Button>
        <button type="button" className="w-full py-2 text-[14px] text-white/70" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? 'أول مرة؟ أنشئ حسابك' : 'عندي حساب'}
        </button>
      </form>
    </div>
  );
}
