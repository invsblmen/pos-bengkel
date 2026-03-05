// Centralized datetime helpers (no timezone surprises)

// Accepts 'YYYY-MM-DD HH:mm[:ss]' or 'YYYY-MM-DDTHH:mm[:ss]' strings
export function toInputValue(s) {
  if (!s) return '';
  const str = s.includes('T') ? s : s.replace(' ', 'T');
  return str.slice(0, 16);
}

export function toDisplayTime(s) {
  if (!s) return '';
  if (s.includes('T')) return s.substring(11, 16);
  const parts = s.split(' ');
  return (parts[1] || '').substring(0, 5);
}

export function toDisplayDate(s, locale = 'id-ID') {
  if (!s) return '';
  const str = s.includes('T') ? s : s.replace(' ', 'T');
  const d = new Date(str);
  return d.toLocaleDateString(locale, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function toDisplayDateLong(s, locale = 'id-ID') {
  if (!s) return '';
  const str = s.includes('T') ? s : s.replace(' ', 'T');
  const d = new Date(str);
  return d.toLocaleDateString(locale, {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function isPast(s) {
  if (!s) return false;
  const str = s.includes('T') ? s : s.replace(' ', 'T');
  return new Date(str) < new Date();
}

// Full date-time display using local locale safely
export function toDisplayDateTime(s, locale = 'id-ID') {
  if (!s) return '';
  const str = s.includes('T') ? s : s.replace(' ', 'T');
  const d = new Date(str);
  return d.toLocaleString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Local-safe YYYY-MM-DD for date inputs (no UTC/ISO shift)
export function dateToLocalDateInput(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayLocalDate() {
  return dateToLocalDateInput(new Date());
}

// Get current datetime in format for datetime-local input (YYYY-MM-DDTHH:mm)
export function nowLocalDateTime() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}`;
}

// Extract date portion (yyyy-MM-dd) from ISO datetime string
// Avoids timezone shifts by simply taking first 10 chars
export function extractDateFromISO(dateString) {
  if (!dateString) return '';
  // Extract first 10 chars from ISO format (yyyy-MM-dd)
  return dateString.substring(0, 10);
}
