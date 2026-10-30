// ينسخ منطق الحضور والإشعارات من الواجهة إلى دالة push (Deno يحتاج امتداد .ts في الاستيراد)
import { readFileSync, writeFileSync } from 'node:fs';
const dir = 'supabase/functions/push';
writeFileSync(`${dir}/rules.ts`, readFileSync('src/lib/rules.ts', 'utf8'));
writeFileSync(`${dir}/notify.ts`, readFileSync('src/lib/notify.ts', 'utf8').replace("from './rules'", "from './rules.ts'"));
console.log('synced');
