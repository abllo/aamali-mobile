import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/data';
import { Button } from '../components/ui';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase!.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      const m = error.message;
      toast.error(m.includes('Invalid') ? 'البريد أو كلمة المرور غير صحيحة'
        : m.includes('not confirmed') ? 'الحساب غير مفعّل' : m);
    }
  }

  return (
    <div className="hero flex min-h-dvh flex-col items-center justify-center px-6">
      <img src="./logo-mark-white.png" alt="أعمالي" className="mb-10 h-24 w-auto" />
      <form onSubmit={submit} className="w-full max-w-sm space-y-3">
        <input type="email" required autoComplete="email" placeholder="البريد" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr"
          className="h-13 w-full rounded-2xl bg-white/10 px-4 py-3.5 text-[16px] text-white placeholder:text-white/50 outline-none ring-1 ring-white/15 focus:ring-[#D9B662]" />
        <input type="password" required autoComplete="current-password" placeholder="كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr"
          className="h-13 w-full rounded-2xl bg-white/10 px-4 py-3.5 text-[16px] text-white placeholder:text-white/50 outline-none ring-1 ring-white/15 focus:ring-[#D9B662]" />
        <Button variant="white" className="w-full" loading={busy}>دخول</Button>
      </form>
    </div>
  );
}
