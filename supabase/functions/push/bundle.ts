// ملف مُولَّد من index.ts + notify.ts + rules.ts للصق في محرر Supabase (npm run bundle:function)

// supabase/functions/push/rules.ts
var NORMAL = { flexStart: 480, flexEnd: 540, hours: 420, latestExit: 960 };
var RAMADAN = { flexStart: 600, flexEnd: 600, hours: 300, latestExit: 900 };
var DEFAULT_SETTINGS = {
  allowance: 419,
  workdays: [0, 1, 2, 3, 4],
  normal: NORMAL,
  ramadan: RAMADAN,
  ramadanStart: null,
  ramadanEnd: null,
  managerPool: null,
  warnAt: 300,
  customAlerts: [{ id: "ca1", time: "14:45", text: "\u0627\u0644\u0645\u062A\u0628\u0642\u064A \u0639\u0644\u0649 \u0646\u0647\u0627\u064A\u0629 \u0627\u0644\u062F\u0648\u0627\u0645 \u0661\u0665 \u062F\u0642\u064A\u0642\u0629", days: "work", on: false }],
  notify: { day: true, remind: true, balance: true, geo: true, custom: true }
};
var pad = (n) => String(n).padStart(2, "0");
function toMin(t) {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  return h > 23 || mi > 59 ? null : h * 60 + mi;
}
function secOf(t) {
  const m = /^\d{1,2}:\d{2}:(\d{2})/.exec(t ?? "");
  return m ? Number(m[1]) : 0;
}
var hm = (m) => `${Math.floor(Math.abs(m) / 60)}:${pad(Math.abs(m) % 60)}`;
function dur(m) {
  m = Math.max(0, Math.round(m));
  const h = Math.floor(m / 60), r = m % 60;
  if (!h) return `${r} \u062F`;
  return r ? `${h} \u0633 ${r} \u062F` : `${h} \u0633`;
}
function clock(m) {
  m = (Math.round(m) % 1440 + 1440) % 1440;
  const h = Math.floor(m / 60);
  return { t: `${h % 12 || 12}:${pad(m % 60)}`, ap: h >= 12 ? "\u0645" : "\u0635" };
}
var clockText = (m) => {
  const c = clock(m);
  return `${c.t} ${c.ap}`;
};
function weekday(date) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
function addDays(date, n) {
  const [y, m, d] = date.split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1, d + n));
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
}
var monthOf = (date) => date.slice(0, 7);
function monthDays(month) {
  const [y, m] = month.split("-").map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${month}-${pad(i + 1)}`);
}
function riyadhNow(d = /* @__PURE__ */ new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute) };
}
function hijriMonth(date) {
  const [y, m, d] = date.split("-").map(Number);
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { month: "numeric", timeZone: "UTC" }).formatToParts(new Date(Date.UTC(y, m - 1, d, 12)));
    return Number(parts.find((p) => p.type === "month")?.value ?? 0);
  } catch {
    return 0;
  }
}
function isRamadan(date, s) {
  if (s.ramadanStart && s.ramadanEnd) return date >= s.ramadanStart && date <= s.ramadanEnd;
  return hijriMonth(date) === 9;
}
function nextRamadanStart(from, s) {
  if (s.ramadanStart && s.ramadanStart >= from) return s.ramadanStart;
  for (let i = 0; i < 400; i++) {
    const d = addDays(from, i);
    if (hijriMonth(d) === 9 && hijriMonth(addDays(d, -1)) !== 9) return d;
  }
  return null;
}
var scheduleFor = (date, s) => isRamadan(date, s) ? s.ramadan : s.normal;
var isWorkday = (date, s) => s.workdays.includes(weekday(date));
function expectedExit(enter, sc) {
  if (enter <= sc.flexStart) return sc.flexStart + sc.hours;
  if (enter <= sc.flexEnd) return Math.min(enter + sc.hours, sc.latestExit);
  return sc.latestExit;
}
var lateOf = (enter, sc) => Math.max(0, enter - sc.flexEnd);
function calcDay(date, rec, s, today) {
  const base = { date, status: "none", enter: null, exit: null, expected: null, expectedSafe: null, late: 0, early: 0, raw: 0, credit: 0, used: 0, provisional: false };
  if (!isWorkday(date, s)) return { ...base, status: "off" };
  if (rec?.kind && rec.kind !== "work") return { ...base, status: "blocked" };
  const sc = scheduleFor(date, s);
  const enter = toMin(rec?.enter), exit = toMin(rec?.exit);
  const provisional = [rec?.enterSource, rec?.exitSource].some((x) => x === "success" || x === "open");
  if (enter == null) {
    if (date > today) return { ...base, status: "future" };
    return { ...base, status: date < today ? "absent" : "none" };
  }
  const expected = expectedExit(enter, sc);
  const expectedSafe = expected + (secOf(rec?.enter) > 0 && enter > sc.flexStart && enter < sc.flexEnd ? 1 : 0);
  const late = lateOf(enter, sc);
  if (exit == null) {
    return { ...base, status: date < today ? "missingExit" : "open", enter, expected, expectedSafe, late, raw: late, used: 0, provisional };
  }
  const early = Math.max(0, expected - exit);
  const raw = late + early;
  const credit = rec?.excuseState === "approved" ? Math.min(raw, Math.max(0, rec.excuseMinutes ?? 0)) : 0;
  return { ...base, status: "complete", enter, exit, expected, expectedSafe, late, early, raw, credit, used: raw - credit, provisional };
}
function calcMonth(month, records, s, today) {
  const days = monthDays(month).map((d) => calcDay(d, records[d], s, today));
  let used = 0, completeCount = 0, approvedCredit = 0, todayLate = 0;
  const missing = [];
  const remainingWorkdays = [];
  for (const c of days) {
    if (c.status === "complete") {
      used += c.used;
      completeCount++;
      approvedCredit += c.credit;
    }
    if (c.status === "absent" || c.status === "missingExit") missing.push(c.date);
    if (c.date === today && c.status === "open") todayLate = c.late;
    if (c.date >= today && (c.status === "future" || c.status === "none" || c.status === "open")) remainingWorkdays.push(c.date);
  }
  const remaining = s.allowance - used;
  const todayShare = remainingWorkdays.length ? Math.floor(Math.max(0, remaining) / remainingWorkdays.length) : 0;
  const avg = completeCount ? used / completeCount : 0;
  const projected = Math.round(used + avg * remainingWorkdays.length);
  let exceedDate = null;
  if (completeCount >= 2 && avg > 0 && remaining > 0) {
    const n = Math.floor(remaining / avg);
    if (n < remainingWorkdays.length) exceedDate = remainingWorkdays[n] ?? null;
  }
  return { month, days, used, remaining, todayLate, remainingWorkdays, todayShare, missing, completeCount, avg, projected, exceedDate, approvedCredit };
}
function calcToday(m, records, s, now) {
  const day = m.days.find((d) => d.date === now.date) ?? calcDay(now.date, records[now.date], s, now.date);
  const sc = scheduleFor(now.date, s);
  let allowedExit = null;
  let leaveNow = null;
  if (day.status === "open" && day.enter != null && day.expectedSafe != null) {
    allowedExit = Math.max(day.enter, day.expectedSafe - Math.max(0, m.todayShare - day.late));
    const cost = day.late + Math.max(0, day.expectedSafe - now.min);
    leaveNow = { cost, after: m.remaining - cost };
  }
  return { day, schedule: sc, ramadan: isRamadan(now.date, s), allowedExit, leaveNow, flexEnd: sc.flexEnd };
}
function remediation(m, records, s, target = s.allowance) {
  const submitted = m.days.filter((d) => d.status === "complete" && records[d.date]?.excuseState === "submitted").map((d) => ({ date: d.date, minutes: Math.min(d.raw, records[d.date]?.excuseMinutes ?? d.raw), dayUsed: d.used }));
  const pendingCredit = submitted.reduce((a, x) => a + x.minutes, 0);
  const over = Math.max(0, m.used - pendingCredit - target);
  const items = [];
  if (over > 0) {
    const candidates = m.days.filter((d) => d.status === "complete" && d.used > 0 && !records[d.date]?.excuseState).sort((a, b) => b.used - a.used || a.date.localeCompare(b.date));
    let need = over;
    for (const d of candidates) {
      if (need <= 0) break;
      items.push({ date: d.date, minutes: d.used, dayUsed: d.used });
      need -= d.used;
    }
    if (items.length > 0 && need <= 0) {
      const covered = items.slice(0, -1).reduce((a, x) => a + x.minutes, 0);
      const rest = over - covered;
      const chosen = new Set(items.map((x) => x.date));
      const smaller = candidates.filter((d) => !chosen.has(d.date) && d.used >= rest).sort((a, b) => a.used - b.used)[0];
      const last = items[items.length - 1];
      if (smaller && smaller.used < last.minutes) items[items.length - 1] = { date: smaller.date, minutes: smaller.used, dayUsed: smaller.used };
    }
  }
  const planned = items.reduce((a, x) => a + x.minutes, 0);
  const pool = s.managerPool ?? null;
  const poolLeft = pool == null ? null : pool - m.approvedCredit - pendingCredit - planned;
  return { over, items, after: m.used - pendingCredit - planned, poolLeft, submitted };
}

// supabase/functions/push/notify.ts
var WEEKDAY = ["\u0627\u0644\u0623\u062D\u062F", "\u0627\u0644\u0627\u062B\u0646\u064A\u0646", "\u0627\u0644\u062B\u0644\u0627\u062B\u0627\u0621", "\u0627\u0644\u0623\u0631\u0628\u0639\u0627\u0621", "\u0627\u0644\u062E\u0645\u064A\u0633", "\u0627\u0644\u062C\u0645\u0639\u0629", "\u0627\u0644\u0633\u0628\u062A"];
var MONTH = ["\u064A\u0646\u0627\u064A\u0631", "\u0641\u0628\u0631\u0627\u064A\u0631", "\u0645\u0627\u0631\u0633", "\u0623\u0628\u0631\u064A\u0644", "\u0645\u0627\u064A\u0648", "\u064A\u0648\u0646\u064A\u0648", "\u064A\u0648\u0644\u064A\u0648", "\u0623\u063A\u0633\u0637\u0633", "\u0633\u0628\u062A\u0645\u0628\u0631", "\u0623\u0643\u062A\u0648\u0628\u0631", "\u0646\u0648\u0641\u0645\u0628\u0631", "\u062F\u064A\u0633\u0645\u0628\u0631"];
function dayName(date) {
  const [y, m, d] = date.split("-").map(Number);
  return `${WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MONTH[m - 1]}`;
}
var at = (now, t, window = 60) => now >= t && now < t + window;
function dueNotices({ records, settings: s, now }) {
  const out = [];
  const today = now.date;
  const m = calcMonth(monthOf(today), records, s, today);
  const t = calcToday(m, records, s, now);
  const rec = records[today];
  const d = t.day;
  const work = isWorkday(today, s) && d.status !== "blocked";
  if (work) {
    if (d.status === "none" && at(now.min, t.schedule.flexStart + 5, 30)) {
      out.push({ key: `notyet-${today}`, cat: "remind", title: "\u0644\u0645 \u062A\u064F\u0633\u062C\u064E\u0651\u0644 \u0628\u0635\u0645\u0629 \u0627\u0644\u062D\u0636\u0648\u0631", body: "\u0627\u0636\u063A\u0637 \u0644\u062A\u0633\u062C\u064A\u0644 \u062D\u0627\u0644\u0629 \u0627\u0644\u064A\u0648\u0645", url: "./#/?ask=today" });
    }
    if (d.status === "none" && at(now.min, t.flexEnd - 15, 15)) {
      out.push({
        key: `flex-${today}`,
        cat: "remind",
        title: "\u062A\u0646\u062A\u0647\u064A \u0627\u0644\u0645\u0631\u0648\u0646\u0629 \u0628\u0639\u062F 15 \u062F\u0642\u064A\u0642\u0629",
        body: `\u0628\u0639\u062F ${clockText(t.flexEnd)} \u064A\u064F\u062D\u062A\u0633\u0628 \u062A\u0623\u062E\u064A\u0631\u060C \u0648\u0627\u0644\u0627\u0646\u0635\u0631\u0627\u0641 ${clockText(t.schedule.latestExit)}`,
        url: "./#/?ask=today"
      });
    }
    if (d.enter != null && d.expectedSafe != null) {
      const allowed = t.allowedExit != null && t.allowedExit < d.expectedSafe ? ` \xB7 \u0627\u0644\u0645\u0633\u0645\u0648\u062D ${clockText(t.allowedExit)}` : "";
      out.push({
        key: `in-${today}`,
        cat: "day",
        title: `\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062D\u0636\u0648\u0631 ${clockText(d.enter)}${d.late ? ` \xB7 \u062A\u0623\u062E\u064A\u0631 ${dur(d.late)}` : ""}`,
        body: `\u0627\u0644\u0627\u0646\u0635\u0631\u0627\u0641 ${clockText(d.expectedSafe)}${d.status === "open" ? allowed : ""}`,
        url: "./"
      });
    }
    if (d.status === "open" && d.enter != null && d.expectedSafe != null) {
      const exp = d.expectedSafe;
      const mid = Math.round((d.enter + exp) / 2);
      if (at(now.min, mid, 30)) {
        out.push({ key: `half-${today}`, cat: "remind", title: `\u0645\u0646\u062A\u0635\u0641 \u0627\u0644\u062F\u0648\u0627\u0645 \xB7 \u0627\u0644\u0645\u062A\u0628\u0642\u064A ${hm(exp - now.min)}`, body: `\u0627\u0644\u0627\u0646\u0635\u0631\u0627\u0641 ${clockText(exp)}`, url: "./" });
      }
      if (t.allowedExit != null && t.allowedExit < exp - 5 && at(now.min, t.allowedExit, 30)) {
        out.push({
          key: `allowed-${today}`,
          cat: "remind",
          title: "\u064A\u0645\u0643\u0646\u0643 \u0627\u0644\u0627\u0646\u0635\u0631\u0627\u0641 \u0627\u0644\u0622\u0646 \u0636\u0645\u0646 \u062E\u0637\u0629 \u0627\u0644\u0634\u0647\u0631",
          body: `\u0627\u0644\u062E\u0635\u0645 ${dur(exp - now.min + d.late)} \xB7 \u0627\u0644\u0627\u0646\u0635\u0631\u0627\u0641 \u0627\u0644\u0643\u0627\u0645\u0644 ${clockText(exp)}`,
          url: "./"
        });
      }
      if (at(now.min, exp - 15, 15)) {
        out.push({ key: `pre-${today}`, cat: "remind", title: `\u062A\u0628\u0642\u0651\u0649 15 \u062F\u0642\u064A\u0642\u0629 \u0639\u0644\u0649 \u0627\u0644\u0627\u0646\u0635\u0631\u0627\u0641`, body: clockText(exp), url: "./" });
      }
      if (at(now.min, exp, 20)) {
        out.push({ key: `exitnow-${today}`, cat: "remind", title: "\u062D\u0627\u0646 \u0648\u0642\u062A \u0627\u0644\u0627\u0646\u0635\u0631\u0627\u0641", body: "\u0633\u062C\u0651\u0644 \u0628\u0635\u0645\u0629 \u0627\u0644\u0627\u0646\u0635\u0631\u0627\u0641", url: "./" });
      }
      if (at(now.min, exp + 20, 120)) {
        out.push({ key: `exitdue-${today}`, cat: "remind", title: "\u0644\u0645 \u062A\u064F\u0633\u062C\u064E\u0651\u0644 \u0628\u0635\u0645\u0629 \u0627\u0644\u0627\u0646\u0635\u0631\u0627\u0641", body: "\u0627\u0641\u062A\u062D \u062D\u0627\u0636\u0631+ \u0644\u0644\u062A\u062D\u062F\u064A\u062B\u060C \u0623\u0648 \u0623\u0636\u0641 \u0628\u0635\u0645\u0629 \u064A\u062F\u0648\u064A\u0629", url: "./" });
      }
    }
    if (d.status === "complete" && d.exit != null) {
      const after = s.allowance - m.used;
      out.push({
        key: `out-${today}`,
        cat: "day",
        title: `\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u0627\u0646\u0635\u0631\u0627\u0641 ${clockText(d.exit)} \xB7 ${d.used ? `\u062E\u0635\u0645 ${dur(d.used)}` : "\u062F\u0648\u0646 \u062E\u0635\u0645"}`,
        body: after >= 0 ? `\u0627\u0644\u0645\u062A\u0628\u0642\u064A \u0645\u0646 \u0627\u0644\u0631\u0635\u064A\u062F ${hm(after)} \u0645\u0646 ${hm(s.allowance)}` : `\u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u0631\u0635\u064A\u062F \u0628\u0640 ${dur(-after)}`,
        url: "./"
      });
    }
    if (rec?.arrivedAt && d.enter == null) {
      const a = toM(rec.arrivedAt);
      if (a != null && now.min >= a + 10) out.push({ key: `arrive-${today}`, cat: "geo", title: "\u0648\u0635\u0644\u062A \u0645\u0642\u0631 \u0627\u0644\u0639\u0645\u0644 \u0648\u0644\u0645 \u062A\u064F\u0633\u062C\u064E\u0651\u0644 \u0628\u0635\u0645\u0629 \u0627\u0644\u062D\u0636\u0648\u0631", url: "./" });
    }
    if (rec?.leftAt && d.status === "open") {
      out.push({ key: `left-${today}`, cat: "geo", title: "\u063A\u0627\u062F\u0631\u062A \u0645\u0642\u0631 \u0627\u0644\u0639\u0645\u0644 \u0648\u0644\u0645 \u062A\u064F\u0633\u062C\u064E\u0651\u0644 \u0628\u0635\u0645\u0629 \u0627\u0644\u0627\u0646\u0635\u0631\u0627\u0641", url: "./" });
    }
  }
  const y = lastWorkday(today, s);
  if (y && at(now.min, 7 * 60 + 30, 90)) {
    const yc = calcMonth(monthOf(y), records, s, today).days.find((x) => x.date === y);
    if (yc && (yc.status === "missingExit" || yc.status === "absent")) {
      out.push({
        key: `missing-${y}`,
        cat: "remind",
        title: `\u0628\u064A\u0627\u0646\u0627\u062A ${dayName(y)} \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629`,
        body: yc.status === "absent" ? "\u0644\u0627 \u062A\u0648\u062C\u062F \u0628\u0635\u0645\u0629" : "\u0644\u0627 \u064A\u0648\u062C\u062F \u0648\u0642\u062A \u0627\u0646\u0635\u0631\u0627\u0641",
        url: "./#/log"
      });
    }
  }
  const month = monthOf(today);
  if (m.used >= s.warnAt && m.used <= s.allowance) {
    out.push({
      key: `warn-${month}`,
      cat: "balance",
      title: `\u0627\u0644\u0627\u0633\u062A\u0647\u0644\u0627\u0643 ${hm(m.used)} \u0645\u0646 ${hm(s.allowance)}`,
      body: `\u0627\u0644\u0645\u062A\u0628\u0642\u064A ${hm(m.remaining)} \xB7 \u0627\u0644\u0645\u0633\u0645\u0648\u062D \u064A\u0648\u0645\u064A\u0627\u064B ${dur(m.todayShare)}`,
      url: "./#/balance"
    });
  }
  if (m.used > s.allowance) {
    const p = remediation(m, records, s);
    const first = p.items[0];
    out.push({
      key: `over-${month}-${m.used}`,
      cat: "balance",
      title: `\u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u0631\u0635\u064A\u062F \u0628\u0640 ${dur(m.used - s.allowance)}`,
      body: first ? `\u064A\u064F\u0642\u062A\u0631\u062D \u0627\u0633\u062A\u0626\u0630\u0627\u0646 ${dayName(first.date)} (${dur(first.minutes)})${p.items.length > 1 ? ` \u0648${p.items.length - 1} \u064A\u0648\u0645 \u0622\u062E\u0631` : ""}` : void 0,
      url: "./#/balance"
    });
  }
  if ((/* @__PURE__ */ new Date(`${today}T12:00:00Z`)).getUTCDay() === 4 && at(now.min, 16 * 60, 60) && m.completeCount >= 2) {
    out.push({
      key: `week-${today}`,
      cat: "balance",
      title: m.exceedDate ? `\u064A\u064F\u062A\u0648\u0642\u0639 \u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u0631\u0635\u064A\u062F \u0642\u0628\u0644 ${dayName(m.exceedDate)}` : `\u0645\u0644\u062E\u0635 \u0627\u0644\u0623\u0633\u0628\u0648\u0639 \xB7 \u0627\u0644\u0645\u062A\u0628\u0642\u064A ${hm(Math.max(0, m.remaining))}`,
      body: `\u0645\u062A\u0648\u0633\u0637 \u0627\u0644\u0627\u0633\u062A\u0647\u0644\u0627\u0643 \u0627\u0644\u064A\u0648\u0645\u064A ${dur(m.avg)}`,
      url: "./#/balance"
    });
  }
  for (const a of s.customAlerts ?? []) {
    const tm = toM(a.time);
    if (!a.on || tm == null || !a.text.trim()) continue;
    if (a.days === "work" && !work) continue;
    if (at(now.min, tm, 20)) out.push({ key: `ca-${a.id}-${today}`, cat: "custom", title: a.text.trim(), url: "./" });
  }
  const r = nextRamadanStart(today, s);
  if (r && addDays(r, -1) === today && at(now.min, 20 * 60, 120)) {
    out.push({
      key: `ramadan-${r}`,
      cat: "remind",
      title: "\u064A\u0628\u062F\u0623 \u0631\u0645\u0636\u0627\u0646 \u063A\u062F\u0627\u064B",
      body: `\u062F\u0648\u0627\u0645 \u0631\u0645\u0636\u0627\u0646: ${clockText(s.ramadan.flexStart)} \u2013 ${clockText(s.ramadan.flexStart + s.ramadan.hours)}`,
      url: "./#/more"
    });
  }
  return out.filter((n) => s.notify?.[n.cat] !== false);
}
function toM(t) {
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
function lastWorkday(date, s) {
  for (let i = 1; i <= 7; i++) {
    const d = addDays(date, -i);
    if (isWorkday(d, s)) return d;
  }
  return null;
}

// supabase/functions/push/index.ts
var env = (k) => (
  // deno-lint-ignore no-explicit-any
  globalThis.Deno?.env.get(k) ?? globalThis.process?.env?.[k] ?? ""
);
var SUPABASE_URL = () => env("SUPABASE_URL").replace(/\/$/, "");
var SERVICE_KEY = () => env("SUPABASE_SERVICE_ROLE_KEY");
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
var json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
var enc = new TextEncoder();
function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64url(s) {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}
function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
async function generateVapid() {
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  return { publicKey: b64url(raw), privateJwk: await crypto.subtle.exportKey("jwk", kp.privateKey) };
}
async function vapidHeader(endpoint, vapid, subject) {
  const header = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64url(enc.encode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1e3) + 12 * 3600,
    sub: subject
  })));
  const key = await crypto.subtle.importKey("jwk", vapid.privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${header}.${claims}`)));
  return `vapid t=${header}.${claims}.${b64url(sig)}, k=${vapid.publicKey}`;
}
async function hkdf(salt, ikm, info, bytes) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, bytes * 8));
}
async function encryptPayload(payload, p256dh, authSecret) {
  const uaPublic = unb64url(p256dh);
  const auth = unb64url(authSecret);
  const local = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", local.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, local.privateKey, 256));
  const ikm = await hkdf(auth, shared, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, concat(payload, new Uint8Array([2]))));
  const header = new Uint8Array(16 + 4 + 1 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, cipher);
}
async function sendOne(m, vapid, subject, fetchImpl = fetch) {
  const body = await encryptPayload(enc.encode(JSON.stringify(m.payload)), m.p256dh, m.auth);
  const res = await fetchImpl(m.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidHeader(m.endpoint, vapid, subject),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "high"
    },
    body
  });
  await res.body?.cancel().catch(() => {
  });
  return res.status;
}
async function rpc(fn, args = {}) {
  const res = await fetch(`${SUPABASE_URL()}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY(), Authorization: `Bearer ${SERVICE_KEY()}`, "Content-Type": "application/json" },
    body: JSON.stringify(args)
  });
  if (!res.ok) throw new Error(`${fn}: ${res.status} ${await res.text()}`);
  return await res.json();
}
async function ensureConfig() {
  let cfg = await rpc("push_config_get");
  const url = `${SUPABASE_URL()}/functions/v1/push`;
  if (!cfg.vapid_public || !cfg.vapid_private || cfg.function_url !== url) {
    const fresh = cfg.vapid_public ? null : await generateVapid();
    cfg = await rpc("push_config_set", { p_public: fresh?.publicKey ?? null, p_private: fresh?.privateJwk ?? null, p_function_url: url });
  }
  return cfg;
}
async function currentUser(req) {
  const authz = req.headers.get("Authorization");
  if (!authz?.startsWith("Bearer ")) return null;
  const res = await fetch(`${SUPABASE_URL()}/auth/v1/user`, { headers: { apikey: SERVICE_KEY(), Authorization: authz } });
  if (!res.ok) return null;
  return (await res.json()).id ?? null;
}
async function deliver(messages, cfg) {
  const vapid = { publicKey: cfg.vapid_public, privateJwk: cfg.vapid_private };
  let sent = 0;
  await Promise.all(messages.map(async (m) => {
    try {
      const status = await sendOne(m, vapid, cfg.subject);
      if (status >= 200 && status < 300) {
        sent++;
        await rpc("push_result", { p_endpoint: m.endpoint, p_ok: true }).catch(() => {
        });
      } else if (status === 404 || status === 410) await rpc("push_result", { p_endpoint: m.endpoint, p_ok: false }).catch(() => {
      });
    } catch (e) {
      console.error("push", e);
    }
  }));
  return sent;
}
async function tick(cfg, user) {
  const inputs = await rpc("tick_inputs", { p_user: user });
  const now = riyadhNow();
  let total = 0;
  for (const u of inputs) {
    const settings = { ...DEFAULT_SETTINGS, ...u.settings };
    const records = Object.fromEntries(u.days.map((d) => [d.date, d]));
    const sent = new Set(u.sent);
    const due = dueNotices({ records, settings, now }).filter((n) => !sent.has(n.key));
    if (!due.length || !u.subs.length) continue;
    const fresh = new Set(await rpc("push_mark_sent", { p_user: u.user_id, p_keys: due.map((n) => n.key) }));
    const messages = due.filter((n) => fresh.has(n.key)).flatMap((n) => u.subs.map((s) => ({
      ...s,
      payload: { title: n.title, body: n.body ?? "", tag: n.key, url: n.url ?? "./" }
    })));
    total += await deliver(messages, cfg);
  }
  return total;
}
async function handle(req) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const cfg = await ensureConfig();
    if (body.action === "init" || body.action === "test") {
      const userId = await currentUser(req);
      if (!userId) return json({ error: "unauthorized" }, 401);
      if (body.action === "init") return json({ publicKey: cfg.vapid_public });
      return json({ sent: await deliver(await rpc("push_test_messages", { p_user: userId }), cfg) });
    }
    if (!body.secret || body.secret !== cfg.hook_secret) return json({ error: "unauthorized" }, 401);
    if (body.kind === "tick") return json({ sent: await tick(cfg, body.user ?? null) });
    return json({ sent: 0 });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
}
if (globalThis.Deno?.serve) globalThis.Deno.serve(handle);
export {
  b64url,
  encryptPayload,
  generateVapid,
  handle,
  sendOne,
  unb64url,
  vapidHeader
};
