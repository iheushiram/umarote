// 競馬場IDマッピング
export const VENUE_ID_MAP: Record<string, string> = {
  '札幌': '01',
  '函館': '02', 
  '福島': '03',
  '新潟': '04',
  '東京': '05',
  '中山': '06',
  '中京': '07',
  '京都': '08',
  '阪神': '09',
  '小倉': '10'
};

// 逆マッピング（IDから競馬場名）
export const VENUE_NAME_MAP: Record<string, string> = Object.entries(VENUE_ID_MAP).reduce(
  (acc, [name, id]) => ({ ...acc, [id]: name }),
  {}
);

// レースID生成関数
// YYYY + 競馬場ID + 開催回数 + 開催日数 + R数
export function generateRaceId(
  year: number,
  venueName: string,
  meetingNumber: number, // 開催回数（1-6）
  dayNumber: number,     // 開催日数（1-12）
  raceNumber: number     // R数（1-12）
): string {
  const venueId = VENUE_ID_MAP[venueName];
  if (!venueId) {
    throw new Error(`不明な競馬場: ${venueName}`);
  }
  
  const meetingStr = meetingNumber.toString().padStart(1, '0'); // 1桁
  const dayStr = dayNumber.toString().padStart(2, '0');         // 2桁
  const raceStr = raceNumber.toString().padStart(2, '0');       // 2桁
  
  return `${year}${venueId}${meetingStr}${dayStr}${raceStr}`;
}

// レースIDから情報を解析
export function parseRaceId(raceId: string): {
  year: number;
  venueId: string;
  venueName: string;
  meetingNumber: number;
  dayNumber: number;
  raceNumber: number;
} | null {
  // YYYY + 競馬場ID(2桁) + 開催回数(1桁) + 開催日数(2桁) + R数(2桁) = 11桁
  if (raceId.length !== 11) {
    return null;
  }
  
  const year = parseInt(raceId.substring(0, 4));
  const venueId = raceId.substring(4, 6);
  const meetingNumber = parseInt(raceId.substring(6, 7));
  const dayNumber = parseInt(raceId.substring(7, 9));
  const raceNumber = parseInt(raceId.substring(9, 11));
  
  const venueName = VENUE_NAME_MAP[venueId];
  if (!venueName) {
    return null;
  }
  
  return {
    year,
    venueId,
    venueName,
    meetingNumber,
    dayNumber,
    raceNumber
  };
}

// レースID表示用フォーマット
export function formatRaceIdDisplay(raceId: string): string {
  const parsed = parseRaceId(raceId);
  if (!parsed) {
    return raceId;
  }
  
  return `${parsed.year}年 ${parsed.meetingNumber}回${parsed.venueName}${parsed.dayNumber}日目 ${parsed.raceNumber}R`;
}

// 開催情報フォーマット
export function formatMeetingInfo(meetingNumber: number, venueName: string, dayNumber: number): string {
  return `${meetingNumber}回${venueName}${dayNumber}日`;
}

// レースID検証
export function isValidRaceId(raceId: string): boolean {
  return parseRaceId(raceId) !== null;
}