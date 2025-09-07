// CSV取り込み用 race_id ユーティリティ（サーバー側）
// 仕様: YYYY(4) + Venue(2) + Meeting(2) + Day(2) + RaceNo(2) = 12桁

const VENUE_ID_MAP: Record<string, string> = {
  '札幌': '01', '函館': '02', '福島': '03', '新潟': '04', '東京': '05',
  '中山': '06', '中京': '07', '京都': '08', '阪神': '09', '小倉': '10'
};

const SHORT_VENUE_MAP: Record<string, string> = {
  '札': '札幌', '函': '函館', '福': '福島', '新': '新潟', '東': '東京',
  '中': '中山', '名': '中京', '京': '京都', '阪': '阪神', '小': '小倉'
};

export function normalizeDigits(input: string | number | undefined | null): string {
  if (input === undefined || input === null) return '';
  return String(input).replace(/[^0-9]/g, '');
}

export function normalizeDate(raw: string): string {
  const s = normalizeDigits(raw);
  if (!s) return '';
  if (s.length === 6) return `20${s}`; // YYMMDD -> YYYYMMDD
  if (s.length === 8) return s;       // YYYYMMDD
  return s.padStart(8, '0');
}

export function getVenueCode(placeOrShort: string): string {
  const full = SHORT_VENUE_MAP[placeOrShort] || placeOrShort;
  return VENUE_ID_MAP[full] || '99';
}

export function normalizeVenueName(raw: string): string {
  if (!raw) return '';
  const s = String(raw).trim();
  // 1) フル名称が含まれていればそれを返す
  for (const full of Object.keys(VENUE_ID_MAP)) {
    if (s.includes(full)) return full;
  }
  // 2) 短縮1文字を走査（例: "1函C" → '函'）
  for (const ch of s) {
    if (SHORT_VENUE_MAP[ch]) return SHORT_VENUE_MAP[ch];
  }
  // 3) そのまま（getVenueCode側で99になる可能性）
  return s;
}

// 旧形式の「レースID」から meeting/day を推定（例: VVYYMDRR → M=5桁目, D=6桁目）
export function parseMeetingDayFromLegacy(legacyId: string): { meeting?: string; day?: string } {
  const s = normalizeDigits(legacyId);
  if (s.length >= 6) {
    const meeting = s.substring(4, 5).padStart(2, '0');
    const day = s.substring(5, 6).padStart(2, '0');
    return { meeting, day };
  }
  return {};
}

// 開催フィールド（例: "1札6", "3名4", "1函C"）から開催回・会場・日次を抽出
export function parseFromVenueField(venueField: string): { meeting?: string; venueName?: string; day?: string } {
  if (!venueField) return {};
  const raw = String(venueField).trim();
  // パターン: 数字 + 非数字 + 数字（例: 1札6, 3名4）
  const m = raw.match(/^(\d+)([^\d]+)(\d+)$/);
  if (m) {
    const meeting = m[1];
    const symbol = m[2];
    const day = m[3];
    const venueName = normalizeVenueName(symbol);
    return {
      meeting: normalizeDigits(meeting).padStart(2, '0'),
      venueName,
      day: normalizeDigits(day).padStart(2, '0')
    };
  }
  // パターン: 数字 + 非数字（例: 1函C）→ 日次が欠損
  const m2 = raw.match(/^(\d+)([^\d]+)$/);
  if (m2) {
    const meeting = m2[1];
    const symbol = m2[2];
    const venueName = normalizeVenueName(symbol);
    // 記号末尾の英字を日次として扱う（A=10, B=11, C=12, ...）
    const letter = (symbol.match(/[A-Za-z]$/) || [])[0];
    let day: string | undefined = undefined;
    if (letter) {
      const upper = letter.toUpperCase();
      const dayVal = 10 + (upper.charCodeAt(0) - 'A'.charCodeAt(0));
      if (dayVal >= 10 && dayVal <= 35) day = String(dayVal).padStart(2, '0');
    }
    return {
      meeting: normalizeDigits(meeting).padStart(2, '0'),
      venueName,
      day
    };
  }
  // 非対応: 文字列から会場だけでも拾う
  return { venueName: normalizeVenueName(raw) };
}
export function buildRaceId(opts: {
  date: string;        // YYYYMMDD
  place: string;       // 例: 東京/札幌 など
  raceNo: string | number; // R
  meeting?: string | number; // 2桁（なければ '01'）
  day?: string | number;     // 2桁（なければ '01'）
}): string {
  const date = normalizeDate(opts.date);
  const year = date.substring(0, 4);
  const venue = getVenueCode(opts.place);
  const meeting = opts.meeting !== undefined && opts.meeting !== null
    ? normalizeDigits(opts.meeting).padStart(2, '0')
    : '01';
  const day = opts.day !== undefined && opts.day !== null
    ? normalizeDigits(opts.day).padStart(2, '0')
    : '01';
  const rr = normalizeDigits(opts.raceNo).padStart(2, '0');
  return `${year}${venue}${meeting}${day}${rr}`;
}
