const timeFmt = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});
const dayFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
});
const longDayFmt = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
});

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export const formatTime = (iso: string) => timeFmt.format(new Date(iso));

/** "14:32" se for hoje, "ontem" ou "27 de nov." caso contrário (lista). */
export function formatListDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (sameDay(d, now)) return timeFmt.format(d);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return "ontem";
  return dayFmt.format(d).replace(".", "");
}

/** Rótulo do separador de dia dentro da conversa. */
export function formatDayLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (sameDay(d, now)) return "Hoje";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return "Ontem";
  return longDayFmt.format(d);
}

export const dayKey = (iso: string) => new Date(iso).toDateString();

/** 5511999999999 -> +55 (11) 99999-9999 (cai para +dígitos se o formato for outro). */
export function formatPhone(phone: string) {
  const m = /^(55)(\d{2})(9?\d{4})(\d{4})$/.exec(phone);
  if (m) return `+${m[1]} (${m[2]}) ${m[3]}-${m[4]}`;
  return `+${phone}`;
}

export const displayName = (c: { pushName: string | null; phone: string }) =>
  c.pushName?.trim() || formatPhone(c.phone);

export function initials(name: string) {
  const parts = name.replace(/[^\p{L}\p{N} ]/gu, "").trim().split(/\s+/);
  if (!parts[0]) return "#";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : ""))
    .toUpperCase();
}
