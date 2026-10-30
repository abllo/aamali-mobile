/** إشعارات الجوال (Web Push) — الآيفون يسمح فيها لما يكون التطبيق مضاف للشاشة الرئيسية */
import { useEffect, useState } from 'react';
import { DEMO, supabase } from './data';

export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export type PushAvailability = 'ok' | 'install-first' | 'unsupported' | 'denied' | 'demo';
export function pushAvailability(): PushAvailability {
  if (DEMO) return 'demo';
  if (isIOS() && !isStandalone()) return 'install-first';
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return 'ok';
}

export function registerServiceWorker() {
  if (DEMO || !('serviceWorker' in navigator) || import.meta.env.DEV) return;
  navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
}

function keyToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const b = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4));
  const out = new Uint8Array(new ArrayBuffer(b.length));
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

async function callPush<T>(action: 'init' | 'test'): Promise<T> {
  const { data, error } = await supabase!.functions.invoke('push', { body: { action } });
  if (error) throw new Error('تعذّر الاتصال بخدمة الإشعارات');
  return data as T;
}

export function usePush() {
  const [availability, setAvailability] = useState<PushAvailability>(pushAvailability);
  const [reg, setReg] = useState<ServiceWorkerRegistration | null>(null);
  const [sub, setSub] = useState<PushSubscription | null | undefined>(undefined);
  const [publicKey, setPublicKey] = useState<string | null>(null);

  useEffect(() => {
    if (availability !== 'ok') { setSub(null); return; }
    let alive = true;
    (async () => {
      const r = (await navigator.serviceWorker.getRegistration('./')) ?? (await navigator.serviceWorker.register('./sw.js', { scope: './' }));
      if (!alive) return;
      setReg(r);
      setSub((await r.pushManager.getSubscription()) ?? null);
      // المفتاح جاهز قبل الضغطة: الآيفون يشترط طلب الإذن داخل الضغطة مباشرة
      const k = await callPush<{ publicKey: string }>('init').catch(() => null);
      if (alive && k) setPublicKey(k.publicKey);
    })().catch(() => alive && setSub(null));
    return () => { alive = false; };
  }, [availability]);

  async function enable() {
    if (!reg || !publicKey) throw new Error('الإشعارات تتجهز، جرّب بعد ثواني');
    let s: PushSubscription;
    try {
      s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) });
    } catch (e) {
      setAvailability(pushAvailability());
      throw new Error(Notification.permission === 'denied' ? 'الإذن مرفوض. فعّله من الإعدادات ← الإشعارات ← أعمالي' : (e as Error).message);
    }
    const j = s.toJSON();
    const { error } = await supabase!.rpc('push_subscribe', { p_endpoint: j.endpoint, p_p256dh: j.keys?.p256dh, p_auth: j.keys?.auth, p_device: isIOS() ? 'iPhone' : 'جهاز' });
    if (error) throw new Error('ما انحفظ الاشتراك');
    setSub(s);
  }
  async function disable() {
    if (!sub) return;
    await supabase!.rpc('push_unsubscribe', { p_endpoint: sub.endpoint });
    await sub.unsubscribe().catch(() => {});
    setSub(null);
  }
  const test = () => callPush<{ sent: number }>('test');

  return { availability, enabled: Boolean(sub), loading: availability === 'ok' && (sub === undefined || (!sub && !publicKey)), enable, disable, test };
}
