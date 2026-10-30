/** التاريخ الهجري (أم القرى) بأرقام عادية: «٢٠ جمادى الأولى» */
export function hijriText(date: string, withYear = false): string {
  const [y, m, d] = date.split('-').map(Number);
  try {
    return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'long', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' })
      .format(new Date(Date.UTC(y!, m! - 1, d!, 12))).replace(' هـ', '');
  } catch { return ''; }
}
