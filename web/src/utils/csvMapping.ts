// CSV field mapping utilities for Japanese racing data

export interface JapaneseRacingCsvRow {
  Ｍ: string;           // Mark
  日付: string;         // Date
  開催: string;         // Venue
  Ｒ: string;           // Race number
  レース名: string;     // Race name
  馬名: string;         // Horse name
  Ｃ: string;           // Class
  性別: string;         // Sex
  年齢: string;         // Age
  騎手: string;         // Jockey
  斤量: string;         // Weight
  頭数: string;         // Field size
  馬番: string;         // Horse number
  馬印: string;         // Mark 1
  馬印2: string;        // Mark 2
  馬印3: string;        // Mark 3
  馬印4: string;        // Mark 4
  レース印１: string;   // Race mark
  人気: string;         // Popularity
  着順: string;         // Finish position
  '芝・ダ': string;     // Course type
  距離: string;         // Distance
  コース区分: string;   // Course classification
  馬場状態: string;     // Track condition
  賞金: string;         // Prize money
  多頭出し: string;     // Multiple entry
  所属: string;         // Affiliation
  調教師: string;       // Trainer
  走破タイム: string;   // Time
  着差: string;         // Margin
  '2角': string;        // Corner 2
  '3角': string;        // Corner 3
  '4角': string;        // Corner 4
  上り3F: string;       // Last 3F
  PCI: string;          // PCI
  好走: string;         // Good run
  PCI3: string;         // PCI3
  RPCI: string;         // RPCI
  上3F地点差: string;   // 3F point difference
  馬体重: string;       // Horse weight
  馬体重増減: string;   // Horse weight change
  ブリンカー: string;   // Blinkers
  単勝配当: string;     // Win dividend
  複勝配当: string;     // Place dividend
  枠連: string;         // Bracket quinella
  馬連: string;         // Horse quinella
  馬単: string;         // Horse exacta
  '３連複': string;       // Trio
  '３連単': string;       // Trifecta
}

// Mapping from Japanese CSV headers to expected English headers
export const JAPANESE_TO_ENGLISH_MAPPING: Record<string, string> = {
  '日付': 'date',
  'レース名': 'raceName',
  '馬名': 'horseName',
  '騎手': 'jockey',
  '斤量': 'weight',
  '人気': 'popularity',
  '着順': 'finishPosition',
  '芝・ダ': 'courseType',
  '距離': 'distance',
  '馬場状態': 'courseCondition',
  '走破タイム': 'time',
  '着差': 'margin',
  '上り3F': 'lastThreeFurlong',
  '単勝配当': 'odds',
  '開催': 'venue',
  'コース区分': 'courseClassification',
  '2角': 'corner2',
  '3角': 'corner3',
  '4角': 'corner4'
};

// 全角数字→半角数字に正規化
function normalizeDigits(input: string): string {
  return (input || '').replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
}

// Import venue mapping from raceUtils
import { VENUE_ID_MAP } from './raceUtils';

// Course type mapping
export const COURSE_TYPE_MAPPING: Record<string, '芝' | 'ダート'> = {
  '芝': '芝',
  'ダート': 'ダート',
  'ダ': 'ダート'
};

// Track condition mapping  
export const TRACK_CONDITION_MAPPING: Record<string, '良' | '稍' | '重' | '不良'> = {
  '良': '良',
  '稍': '稍',
  '重': '重',
  '不良': '不良'
};

// Generate race ID from components
export function generateRaceIdFromData(
  date: string,
  venue: string,
  raceNumber: string
): string {
  console.log('generateRaceIdFromData input:', { date, venue, raceNumber });
  
  // Parse date to get year - 既に正規化された日付（YYYYMMDD形式）を受け取る
  let year = new Date().getFullYear(); // デフォルトは現在年
  
  // 日付が既にYYYYMMDD形式かどうかを判定
  if (date.length === 8 && /^\d{8}$/.test(date)) {
    // 既にYYYYMMDD形式の場合
    year = parseInt(date.substring(0, 4));
  } else {
    // 元の形式の場合（後方互換性のため）
    const normalizedDate = normalizeDigits(date);
    
    if (normalizedDate.includes('.')) {
      // "2025. 8.10" のような形式
      const parts = normalizedDate.replace(/\s+/g, '').split('.');
      if (parts.length >= 3) {
        year = parseInt(parts[0]);
      }
    } else if (normalizedDate.length === 6) {
      // "250810" のような形式
      year = parseInt('20' + normalizedDate.substring(0, 2));
    } else if (normalizedDate.length === 8) {
      // "20250810" のような形式
      year = parseInt(normalizedDate.substring(0, 4));
    }
  }
  
  console.log('Extracted year:', year, 'from date:', date);
  
  // Extract venue code from venue string
  // 例: "3名4" -> 開催回数: 3, 開催地: 中京, 日目: 4
  // 例: "1札6" -> 開催回数: 1, 開催地: 札幌, 日目: 6
  const normalizedVenue = normalizeDigits(venue);
  console.log('Normalized venue:', normalizedVenue);
  
  // 複数のパターンに対応
  let meetingNum = '1';
  let venueName = '';
  let dayNum = '1';
  
  // パターン1: "3名4" や "1札6" のような形式
  const venueMatch1 = normalizedVenue.match(/^(\d+)([^\d]+)(\d+)$/);
  if (venueMatch1) {
    [, meetingNum, venueName, dayNum] = venueMatch1;
    console.log('Matched venue pattern:', { meetingNum, venueName, dayNum });
    
    // "名"は中京を意味する
    if (venueName === '名') {
      venueName = '中京';
    }
  } else {
    // パターン2: "中京" のような形式（開催地のみ）
    venueName = normalizedVenue;
  }
  
  const venueCode = getVenueCode(venueName);
  const raceNum = normalizeDigits(raceNumber).padStart(2, '0');
  
  console.log('Extracted components:', { 
    year, 
    meetingNum, 
    venueName, 
    venueCode, 
    dayNum, 
    raceNum 
  });
  
  // 開催回数は2桁、日目とRは2桁固定
  const result = `${year}${venueCode}${String(parseInt(meetingNum)).padStart(2, '0')}${String(parseInt(dayNum)).padStart(2, '0')}${raceNum}`;
  console.log('Generated race ID:', result);
  
  return result;
}

// Get venue code mapping using VENUE_ID_MAP
function getVenueCode(venue: string): string {
  // 短縮形のマッピング
  const shortVenueMapping: Record<string, string> = {
    '札': '札幌',
    '函': '函館',
    '福': '福島',
    '新': '新潟',
    '東': '東京',
    '中': '中山',
    '京': '京都',
    '阪': '阪神',
    '小': '小倉',
    '名': '中京'  // 名は中京を意味する
  };
  
  // 短縮形を正式名称に変換
  const fullVenueName = shortVenueMapping[venue] || venue;
  
  // VENUE_ID_MAPからIDを取得
  const venueId = VENUE_ID_MAP[fullVenueName];
  
  console.log('Venue mapping for:', venue, '->', fullVenueName, '->', venueId || '99');
  return venueId || '99';
}

// Generate horse ID from pedigree registration number
export function generateHorseId(pedigreeNumber: string): string {
  if (!pedigreeNumber || pedigreeNumber.trim() === '') {
    throw new Error('血統登録番号が必要です');
  }
  
  // 血統登録番号を正規化（空白除去、全角→半角）
  const normalizedNumber = pedigreeNumber
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    .replace(/\s+/g, '')
    .replace(/[^\d]/g, '');
  
  if (!normalizedNumber || normalizedNumber.length === 0) {
    throw new Error('有効な血統登録番号が必要です');
  }
  
  return normalizedNumber; // 血統登録番号をそのまま返す
}

// Calculate average position from corner positions
export function calculateAveragePosition(corner2: string, corner3: string, corner4: string): number {
  const positions = [corner2, corner3, corner4]
    .map(pos => parseInt(normalizeDigits(pos)) || 0)
    .filter(pos => pos > 0);
    
  if (positions.length === 0) return 0;
  return positions.reduce((sum, pos) => sum + pos, 0) / positions.length;
}

// Extract direction from course classification
export function extractDirection(courseClassification: string): '' | '右' | '左' {
  // 左が含まれていれば左、右が含まれていれば右、どちらも無ければ空文字
  if (courseClassification && courseClassification.includes('左')) {
    return '左';
  }
  if (courseClassification && courseClassification.includes('右')) {
    return '右';
  }
  return '';
}

// 競馬場と距離に基づいて右回り・左回りを判定
export function determineDirectionByVenueAndDistance(venue: string, distance: number): '右' | '左' {
  // 競馬場固有のコース設定
  const venueDirectionMap: Record<string, { default: '右' | '左', exceptions?: { distance: number, direction: '右' | '左' }[] }> = {
    '札幌': { default: '右' },
    '函館': { default: '右' },
    '福島': { default: '右' },
    '新潟': { 
      default: '左',
      exceptions: [{ distance: 1000, direction: '右' }] // 1000mは直線で回らない
    },
    '東京': { default: '左' },
    '中山': { default: '右' },
    '中京': { default: '左' },
    '京都': { default: '右' },
    '阪神': { default: '右' },
    '小倉': { default: '右' }
  };

  const venueConfig = venueDirectionMap[venue];
  if (!venueConfig) {
    // 不明な競馬場の場合は距離で推定
    return distance >= 2000 ? '左' : '右';
  }

  // 例外距離のチェック
  if (venueConfig.exceptions) {
    for (const exception of venueConfig.exceptions) {
      if (distance === exception.distance) {
        return exception.direction;
      }
    }
  }

  return venueConfig.default;
}

// Convert odds format (single win dividend to decimal odds)
export function convertOddsFormat(dividend: string): number {
  const dividendNum = parseFloat(dividend.replace(/[^\d.]/g, ''));
  if (isNaN(dividendNum) || dividendNum === 0) return 1.0;
  
  // Convert dividend (per 100 yen) to decimal odds
  return dividendNum / 100;
}

// 共通のCSV行処理関数
export function processJapaneseCsvRow(
  headers: string[], 
  values: string[], 
  rowIndex: number
): {
  raceResult: any;
  horseData: HorseDataFromCsv | null;
} {
  const rowData: any = {};
  
  // Create mapping from headers to values
  headers.forEach((header, index) => {
    rowData[header] = values[index] || '';
  });
  
  // 通過順フィールドのデバッグ情報
  console.log('=== CSV通過順フィールド確認 ===');
  console.log('利用可能なヘッダー:', headers);
  console.log('通過順フィールドの値:', {
    '2角': rowData['2角'],
    '3角': rowData['3角'],
    '4角': rowData['4角']
  });
  
  console.log('Row data:', rowData);
  console.log('Available headers:', Object.keys(rowData));
  
  const horseName = rowData['馬名'] || '';
  // レース番号の取得 - 複数の可能性を試す
  let raceNumber = normalizeDigits(rowData['Ｒ'] || rowData['R'] || rowData['レース'] || '');
  
  console.log('Race number extraction:', {
    'Ｒ': rowData['Ｒ'],
    'R': rowData['R'],
    'レース': rowData['レース'],
    'normalized': raceNumber
  });
  
  // レース番号が取得できない場合は、レース名から推定
  if (!raceNumber) {
    const raceName = rowData['レース名'] || '';
    console.log('Race name for number estimation:', raceName);
    
    // 名鉄杯の場合は7Rと推定（実際のレース番号に応じて調整）
    if (raceName.includes('名鉄杯')) {
      raceNumber = '7';
    } else {
      raceNumber = ''; // デフォルトは空文字
    }
  }
  
  const rawDate = rowData['日付'] || '';
  const venue = rowData['開催'] || '';
  
  // 日付をYYYYMMDD形式に正規化
  let date = '';
  const normalizedRawDate = normalizeDigits(rawDate);

  if (normalizedRawDate.includes('.')) {
    // "2025. 8.10" のような形式
    const parts = normalizedRawDate.replace(/\s+/g, '').split('.');
    console.log('ドット区切りパーツ:', parts);
    if (parts.length >= 3) {
      const year = parts[0];
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      date = `${year}${month}${day}`;
    }
  } else if (normalizedRawDate.length === 6) {
    // "250810" のような形式
    date = `20${normalizedRawDate}`;
    console.log('6桁処理結果:', date);
  } else if (normalizedRawDate.length === 8) {
    // "20250810" のような形式
    date = normalizedRawDate;
    console.log('8桁処理結果:', date);
  }
  
  console.log('最終的な日付:', date);
  
  console.log('Extracted basic data:', { horseName, raceNumber, rawDate, date, venue });
  
  // Generate required IDs
  console.log('Looking for pedigree number in:', {
    '血統登録番号': rowData['血統登録番号'],
    '血統番号': rowData['血統番号'],
    '登録番号': rowData['登録番号']
  });
  const pedigreeNumber = rowData['血統登録番号'] || rowData['血統番号'] || rowData['登録番号'] || '';
  if (!pedigreeNumber) {
    throw new Error(`行 ${rowIndex + 1}: 血統登録番号が必要です。利用可能なヘッダー: ${Object.keys(rowData).join(', ')}`);
  }
  const horseId = generateHorseId(pedigreeNumber);
  const raceId = generateRaceIdFromData(date, venue, raceNumber);
  console.log('Race ID generation:', { date, venue, raceNumber, raceId });
  const resultId = raceId && horseId ? `${raceId}_${horseId}_${rowIndex}` : `result_${rowIndex}`;
  
  console.log('Generated IDs:', { horseId, raceId, resultId });
  
  // Calculate average position
  const averagePosition = calculateAveragePosition(
    rowData['2角'] || '0',
    rowData['3角'] || '0', 
    rowData['4角'] || '0'
  );
  
  // Extract direction - まずCSVデータから判定を試行、なければ競馬場と距離から判定
  const courseClassification = rowData['コース区分'] || '';
  let direction = extractDirection(courseClassification);
  if (!direction) {
    // CSVデータにない場合は競馬場と距離から判定
    const distance = parseInt((rowData['距離'] || '').replace(/[^\d]/g, '')) || 0;
    const normalizedVenue = normalizeDigits(venue);
    let venueName = '';
    
    // 開催地を抽出
    const venueMatch = normalizedVenue.match(/^(\d+)([^\d]+)(\d+)$/);
    if (venueMatch) {
      venueName = venueMatch[2] === '名' ? '中京' : venueMatch[2];
    } else {
      venueName = normalizedVenue;
    }
    
    direction = determineDirectionByVenueAndDistance(venueName, distance);
  }
  
  // Convert course type - 距離フィールドの先頭文字から判定
  let rawCourseType = '';
  const distanceField = rowData['距離'] || '';
  
  console.log('Course type extraction from distance field:', {
    distanceField,
    firstChar: distanceField.charAt(0)
  });
  
  // 距離フィールドの先頭文字でコース種別を判定
  if (distanceField.startsWith('ダ')) {
    rawCourseType = 'ダート';
  } else if (distanceField.startsWith('芝')) {
    rawCourseType = '芝';
  } else {
    // 先頭文字で判定できない場合は「芝・ダ」フィールドを試す
    rawCourseType = (rowData['芝・ダ'] || '').replace(/\s/g, '');
  }
  
  console.log('Course type extraction:', {
    '芝・ダ': rowData['芝・ダ'],
    rawCourseType,
    finalCourseType: COURSE_TYPE_MAPPING[rawCourseType] || 'ダート'
  });
  const courseType = COURSE_TYPE_MAPPING[rawCourseType] || 'ダート' as any;
  
  // Convert track condition  
  const rawTrackCondition = (rowData['馬場状態'] || '').replace(/\s/g, '');
  const courseCondition = TRACK_CONDITION_MAPPING[rawTrackCondition] || '' as any;
  
  // Convert odds
  const odds = rowData['単勝配当'] ? convertOddsFormat(rowData['単勝配当']) : '' as any;
  
  // 馬の基本情報も含める
  const sex = (rowData['性別'] || '').trim();
  const age = normalizeDigits(rowData['年齢'] || '');
  const trainer = (rowData['調教師'] || '').replace(/^\((?:栗|美)\)\s*/, '');
  const earnings = (() => { const v = (rowData['賞金'] || '').replace(/[^\d.]/g, ''); return v ? parseFloat(v) : 0; })();
  
  // 毛色の取得（新しいCSVフォーマット対応）
  const color = rowData['毛色'] || '';
  
  // 生年と血統情報を抽出
  const birthDate = rowData['生年月日'] || '';
  const birthDateValue = birthDate ? 
    (() => {
      // 生年月日を正規化（YYYY.MM.DD形式からYYYYMMDD形式に変換）
      const parts = birthDate.replace(/\s+/g, '').split('.');
      if (parts.length >= 3) {
        const year = parts[0].padStart(4, '0');
        const month = parts[1].padStart(2, '0');
        const day = parts[2].padStart(2, '0');
        return `${year}${month}${day}`;
      }
      return birthDate.replace(/\.\s*/g, '').replace(/\s+/g, '');
    })() : 
    (age ? `${new Date().getFullYear() - parseInt(age)}0101`.padStart(8, '0') : '');
  const father = rowData['種牡馬'] || rowData['父'] || rowData['父馬'] || '';
  const mother = rowData['母馬'] || rowData['母'] || '';
  const owner = rowData['馬主(レース時)'] || rowData['馬主'] || rowData['オーナー'] || '';
  const breeder = rowData['生産者'] || rowData['ブリーダー'] || '';
  
  console.log('Extracted horse info:', {
    birthDate,
    birthDateValue,
    father,
    mother,
    owner,
    breeder
  });
  
  // 開催情報の解析（processJapaneseCsvRow内で実行）
  const normalizedVenue = normalizeDigits(venue);
  let meetingNum = '1';
  let venueName = '';
  let dayNum = '1';
  
  // パターン1: "3名4" のような形式
  const venueMatch1 = normalizedVenue.match(/^(\d+)([^\d]+)(\d+)$/);
  if (venueMatch1) {
    [, meetingNum, venueName, dayNum] = venueMatch1;
    
    // "名"は中京を意味する
    if (venueName === '名') {
      venueName = '中京';
    }
  } else {
    // パターン2: "中京" のような形式（開催地のみ）
    venueName = normalizedVenue;
  }
  
  // 会場名の変換マッピング
  const venueMapping: Record<string, string> = {
    '札': '札幌',
    '函': '函館',
    '新': '新潟',
    '東': '東京',
    '中': '中山',
    '中京': '中京',
    '京': '京都',
    '阪': '阪神',
    '小': '小倉'
  };
  
  // 短縮名を完全名に変換
  venueName = venueMapping[venueName] || venueName;
  
  // レース番号の取得（raceNumberを使用）
  let raceNo = 1;
  if (raceNumber) {
    raceNo = parseInt(raceNumber);
  }

  // Transform to expected format
  const raceResult = {
    id: resultId,
    raceId: raceId,
    horseId: horseId,
    date: date || '',
    raceName: rowData['レース名'] || '',
    venue: venueName, // 正規化された開催地を使用
    courseType: courseType || 'ダート',
    distance: (() => { 
      const distanceField = rowData['距離'] || '';
      // 距離フィールドから数字のみを抽出（例：ダ1000 → 1000, 芝1000 → 1000）
      const d = distanceField.replace(/[^\d]/g, '');
      return d ? parseInt(d) : 0; 
    })(),
    direction: direction,
    courseCondition: courseCondition || '良',
    // 新規: 1角通過順
    pos1c: (() => {
      const c1 = rowData['1角'] || rowData['１角'] || '';
      const v = c1 && c1 !== '----' ? parseInt(normalizeDigits(c1)) : null;
      return Number.isFinite(v as any) ? v : null;
    })(),
    finishPosition: (() => { 
      const v = rowData['着順'] || '';
      // '----'の場合はnullを返す（レース未確定）
      if (v === '----' || v === '') return null;
      const normalized = normalizeDigits(v);
      return normalized ? parseInt(normalized) : null;
    })(),
    jockey: rowData['騎手'] || '',
    weight: (() => { const w = (rowData['斤量'] || '').toString().replace(/[^\d.]/g, ''); return w ? parseFloat(w) : 0; })(),
    time: (() => { 
      const t = rowData['走破タイム'] || '';
      return t === '----' ? '' : t;
    })(),
    margin: (() => { 
      const m = rowData['着差'] || '';
      return m === '----' ? '' : m;
    })(),
    pos2c: (() => {
      const c2 = rowData['2角'] || '';
      console.log(`通過順2角処理: 元の値="${c2}", 正規化後="${normalizeDigits(c2)}", 結果=${c2 && c2 !== '----' ? parseInt(normalizeDigits(c2)) : null}`);
      return c2 && c2 !== '----' ? parseInt(normalizeDigits(c2)) : null;
    })(),
    pos3c: (() => {
      const c3 = rowData['3角'] || '';
      console.log(`通過順3角処理: 元の値="${c3}", 正規化後="${normalizeDigits(c3)}", 結果=${c3 && c3 !== '----' ? parseInt(normalizeDigits(c3)) : null}`);
      return c3 && c3 !== '----' ? parseInt(normalizeDigits(c3)) : null;
    })(),
    pos4c: (() => {
      const c4 = rowData['4角'] || '';
      console.log(`通過順4角処理: 元の値="${c4}", 正規化後="${normalizeDigits(c4)}", 結果=${c4 && c4 !== '----' ? parseInt(normalizeDigits(c4)) : null}`);
      return c4 && c4 !== '----' ? parseInt(normalizeDigits(c4)) : null;
    })(),
    // 新規: ｺｰﾅｰ（通過順まとめ文字列）
    cornerPassings: (() => {
      const aggregate = rowData['ｺｰﾅｰ'] || rowData['コーナー'] || rowData['通過'] || '';
      // 代表的表記例: "1-1-1-1" や "6-6-5-4"。そのまま保持。
      const value = (aggregate || '').replace(/\s+/g, '');
      return value || null;
    })(),
    averagePosition: (() => {
      const c2 = rowData['2角'] || '';
      const c3 = rowData['3角'] || '';
      const c4 = rowData['4角'] || '';
      return (c2 || c3 || c4) ? averagePosition : 0;
    })(),
    lastThreeFurlong: rowData['上り3F'] || '',
    // 新規: Ave-3F（平均3F）
    averageThreeFurlong: (() => {
      const ave = rowData['Ave-3F'] || rowData['AVE-3F'] || rowData['平均3F'] || '';
      const cleaned = ave.replace(/\s+/g, '');
      return cleaned || null;
    })(),
    odds: odds || 0,
    popularity: (() => { const p = normalizeDigits(rowData['人気'] || ''); return p ? parseInt(p) : 0; })(),
    // 馬の基本情報
    horseName: horseName,
    horseSex: sex,
    horseAge: age,
    horseBirthDate: birthDateValue,
    horseTrainer: trainer,
    horseEarnings: earnings,
    horseFather: father,
    horseMother: mother,
    horseOwner: owner,
    horseBreeder: breeder,
    // レース情報（API用に追加）
    venueNormalized: venueName,
    meetingNumber: parseInt(meetingNum),
    dayNumber: parseInt(dayNum),
    raceNo: raceNo,
    className: (() => {
      const raceName = rowData['レース名'] || '';
      if (raceName.includes('G1') || raceName.includes('Ⅰ')) return 'G1';
      if (raceName.includes('G2') || raceName.includes('Ⅱ')) return 'G2';
      if (raceName.includes('G3') || raceName.includes('Ⅲ')) return 'G3';
      if (raceName.includes('OP') || raceName.includes('L')) return 'OP';
      return '未勝利';
    })(),
    fieldSize: (() => { const f = (rowData['頭数'] || '').replace(/[^\d]/g, ''); return f ? parseInt(f) : undefined; })(),
  };
  
  // 馬情報データを作成
  const horseData: HorseDataFromCsv | null = horseName && pedigreeNumber ? {
    id: horseId,
    name: horseName,
    birthDate: birthDateValue,
    sex: (() => {
      const sexMapping: Record<string, '牡' | '牝' | 'セ'> = {
        '牡': '牡',
        '牝': '牝',  
        'セ': 'セ',
        '騙': 'セ'
      };
      return sexMapping[sex] || '牡';
    })(),
    color: color,
    father: father,
    mother: mother,
    trainer: trainer,
    owner: owner,
    breeder: breeder,
    earnings: earnings,
    currentRaceId: undefined
  } : null;
  
  console.log('Final result with horse info:', {
    horseName: raceResult.horseName,
    horseBirthDate: raceResult.horseBirthDate,
    horseFather: raceResult.horseFather,
    horseMother: raceResult.horseMother
  });
  
  return { raceResult, horseData };
}

// Horse data interface matching the expected format
interface HorseDataFromCsv {
  id: string;
  name: string;
  birthDate: string;
  sex: '牡' | '牝' | 'セ';
  color: string;
  father: string;
  mother: string;
  trainer: string;
  owner: string;
  breeder: string;
  earnings: number;
  currentRaceId?: string;
}

// Extract and deduplicate horses from multiple CSV rows
export function extractHorsesFromCsvData(
  headers: string[], 
  csvRows: string[][]
): HorseDataFromCsv[] {
  const horsesMap = new Map<string, HorseDataFromCsv>();
  
  csvRows.forEach((values, index) => {
    try {
      const { horseData } = processJapaneseCsvRow(headers, values, index);
      if (horseData) {
        const existingHorse = horsesMap.get(horseData.id);
        if (existingHorse) {
          // Merge earnings for the same horse
          existingHorse.earnings += horseData.earnings;
          // Update trainer if current one is empty
          if (!existingHorse.trainer && horseData.trainer) {
            existingHorse.trainer = horseData.trainer;
          }
        } else {
          horsesMap.set(horseData.id, horseData);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '不明なエラー';
      console.error(`行 ${index + 1}: 馬データの抽出に失敗しました - ${errorMessage}`, error);
      // エラーを再スローして上位でキャッチできるようにする
      throw new Error(`行 ${index + 1}: 馬データの抽出に失敗しました - ${errorMessage}`);
    }
  });
  
  return Array.from(horsesMap.values());
}

// レース情報インターフェース
export interface RaceDataFromCsv {
  raceId: string;
  date: string;
  venue: string;
  meetingNumber: number;
  dayNumber: number;
  raceNo: number;
  raceName: string;
  className: string;
  surface: '芝' | 'ダート';
  distance: number;
  direction: '右' | '左';
  trackCond: '良' | '稍' | '重' | '不良';
  fieldSize?: number;
}

// Extract race information from CSV data
export function extractRaceFromCsvData(
  headers: string[], 
  values: string[]
): RaceDataFromCsv | null {
  const rowData: any = {};
  
  // Create mapping from headers to values
  headers.forEach((header, index) => {
    rowData[header] = values[index] || '';
  });
  
  // フィールド値の抽出（柔軟なヘッダーマッチング）
  const findHeaderValue = (patterns: string[], fieldName: string = ''): string => {
    for (const pattern of patterns) {
      if (rowData[pattern]) {
        console.log(`${fieldName}フィールド発見: ${pattern} = ${rowData[pattern]}`);
        return rowData[pattern];
      }
    }
    console.log(`${fieldName}フィールド未発見: パターン ${patterns.join(', ')} はヘッダーに存在しません`);
    return '';
  };

  // 柔軟なヘッダーマッチングで値を取得
  const date = normalizeDigits(findHeaderValue(['日付', '年月日', 'Date'], '日付'));
  const venue = findHeaderValue(['開催', '競馬場', '会場', 'Venue'], '開催');
  const raceName = findHeaderValue(['レース名', 'Race', 'RaceName'], 'レース名');
  const courseType = findHeaderValue(['芝・ダ', '芝ダ', 'コース', 'Surface', 'CourseType'], 'コース種別').replace(/\s/g, '');
  const distance = findHeaderValue(['距離', 'Distance'], '距離');
  const trackCondition = findHeaderValue(['馬場状態', '馬場', 'TrackCondition', 'Condition'], '馬場状態').replace(/\s/g, '');
  const fieldSize = findHeaderValue(['頭数', 'Field', 'FieldSize'], '頭数').replace(/[^\d]/g, '');
  
  // デフォルト値の設定（必須チェックを緩和）
  const finalDate = date || new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const finalVenue = venue || '未指定';
  const finalRaceName = raceName || '不明なレース';
  const finalCourseType = courseType || 'ダ';
  const finalDistance = distance || '1400';
  const finalTrackCondition = trackCondition || '良';
  
  // さらに条件を緩和 - ヘッダーに日本語が含まれていれば処理を継続
  const hasAnyJapaneseData = headers.some(header => 
    ['日付', 'レース名', '開催', '競馬場', '会場', '馬名'].includes(header)
  );
  
  if (!hasAnyJapaneseData) {
    console.log('日本語のレース関連ヘッダーが見つかりません');
    return null; // 日本語ヘッダーが全くない場合のみnullを返す
  }
  
  console.log('レース抽出継続 - 利用可能なフィールド:', {
    date: finalDate,
    venue: finalVenue, 
    raceName: finalRaceName,
    courseType: finalCourseType,
    distance: finalDistance,
    trackCondition: finalTrackCondition
  });
  
  // 開催情報の解析
  const normalizedVenue = normalizeDigits(finalVenue);
  let meetingNum = '1';
  let venueName = '';
  let dayNum = '1';
  
  // パターン1: "3名4" のような形式
  const venueMatch1 = normalizedVenue.match(/^(\d+)([^\d]+)(\d+)$/);
  if (venueMatch1) {
    [, meetingNum, venueName, dayNum] = venueMatch1;
    
    // 短縮形を正式名称に変換
    const shortVenueMapping: Record<string, string> = {
      '札': '札幌',
      '函': '函館',
      '福': '福島',
      '新': '新潟',
      '東': '東京',
      '中': '中山',
      '京': '京都',
      '阪': '阪神',
      '小': '小倉',
      '名': '中京'
    };
    
    venueName = shortVenueMapping[venueName] || venueName;
  } else {
    // パターン2: "中京" のような形式（開催地のみ）
    venueName = normalizedVenue || '東京'; // デフォルトは東京
  }
  
  // レース番号の取得（CSVのＲ列から）
  let raceNo = 1;
  const raceNumber = findHeaderValue(['Ｒ', 'R', 'レース'], 'レース番号');
  if (raceNumber) {
    const normalizedRaceNumber = normalizeDigits(raceNumber);
    if (normalizedRaceNumber) {
      raceNo = parseInt(normalizedRaceNumber);
    }
  }
  
  // 日付の正規化（YYYYMMDD形式）
  let normalizedDate = finalDate;
  let year = new Date().getFullYear(); // デフォルトは現在年
  
  // 日付形式の判定と年抽出、YYYYMMDD形式への変換
  if (finalDate.includes('.')) {
    // "2025. 8.10" のような形式
    const parts = finalDate.replace(/\s+/g, '').split('.');
    if (parts.length >= 3) {
      year = parseInt(parts[0]);
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      normalizedDate = `${year}${month}${day}`;
    }
  } else if (finalDate.length === 6) {
    // "250810" のような形式
    year = parseInt('20' + finalDate.substring(0, 2));
    normalizedDate = `20${finalDate}`;
  } else if (finalDate.length === 8) {
    // "20250810" のような形式
    year = parseInt(finalDate.substring(0, 4));
    normalizedDate = finalDate;
  }
  
  // レースIDの生成（競馬場名を数値IDに変換）
  const venueCode = getVenueCode(venueName);
  const raceId = `${year}${venueCode}${String(parseInt(meetingNum)).padStart(2, '0')}${String(parseInt(dayNum)).padStart(2, '0')}${String(raceNo).padStart(2, '0')}`;
  
  // クラス名の推定
  let className = '';
  if (finalRaceName.includes('G1') || finalRaceName.includes('Ⅰ')) {
    className = 'G1';
  } else if (finalRaceName.includes('G2') || finalRaceName.includes('Ⅱ')) {
    className = 'G2';
  } else if (finalRaceName.includes('G3') || finalRaceName.includes('Ⅲ')) {
    className = 'G3';
  } else if (finalRaceName.includes('OP')) {
    className = 'OP';
  } else {
    className = '未勝利'; // デフォルト
  }
  
  // コース種別の変換 - 距離フィールドの先頭文字から判定
  let surface: '芝' | 'ダート' = 'ダート'; // デフォルト
  if (finalDistance.startsWith('ダ')) {
    surface = 'ダート';
  } else if (finalDistance.startsWith('芝')) {
    surface = '芝';
  } else {
    // 先頭文字で判定できない場合は元のロジックを使用
    surface = COURSE_TYPE_MAPPING[finalCourseType] || 'ダート';
  }
  
  // 馬場状態の変換
  const trackCond = TRACK_CONDITION_MAPPING[finalTrackCondition] || '良';
  
  // 回り方向の判定（競馬場と距離から）
  const distanceNum = parseInt(finalDistance.replace(/[^\d]/g, ''));
  let direction: '右' | '左' = '右';
  
  // まずCSVデータから判定を試行
  const courseClassification = rowData['コース区分'] || '';
  const csvDirection = extractDirection(courseClassification);
  if (csvDirection) {
    direction = csvDirection;
  } else {
    // CSVデータにない場合は競馬場と距離から判定
    direction = determineDirectionByVenueAndDistance(venueName, distanceNum);
  }
  
  return {
    raceId,
    date: normalizedDate,
    venue: venueName,
    meetingNumber: parseInt(meetingNum),
    dayNumber: parseInt(dayNum),
    raceNo,
    raceName: finalRaceName,
    className,
    surface,
    distance: distanceNum,
    direction,
    trackCond,
    fieldSize: fieldSize ? parseInt(fieldSize) : undefined
  };
}

// Extract and deduplicate races from multiple CSV rows
export function extractRacesFromCsvData(
  headers: string[], 
  csvRows: string[][]
): RaceDataFromCsv[] {
  const racesMap = new Map<string, RaceDataFromCsv>();
  
  csvRows.forEach((values, index) => {
    try {
      const raceData = extractRaceFromCsvData(headers, values);
      if (raceData) {
        racesMap.set(raceData.raceId, raceData);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '不明なエラー';
      console.error(`行 ${index + 1}: レースデータの抽出に失敗しました - ${errorMessage}`, error);
    }
  });
  
  return Array.from(racesMap.values());
}

// 出馬表データインターフェース
export interface RaceEntryDataFromCsv {
  id: string;
  raceId: string;
  horseId: string;
  frameNo: number;
  horseNo: number;
  age: number;
  jockey: string;
  weight: number;
  trainer: string;
  affiliation: string;
  popularity?: number;
  bodyWeight?: number;
  bodyWeightDiff?: number;
  blinkers?: boolean;
  date: string; // 追加
}

// Extract race entry from CSV data
export function extractRaceEntryFromCsvData(
  headers: string[], 
  values: string[]
): RaceEntryDataFromCsv | null {
  const rowData: any = {};
  
  // Create mapping from headers to values
  headers.forEach((header, index) => {
    rowData[header] = values[index] || '';
  });
  
  // フィールド値の抽出（柔軟なヘッダーマッチング）
  const findHeaderValue = (patterns: string[], fieldName: string = ''): string => {
    for (const pattern of patterns) {
      if (rowData[pattern]) {
        console.log(`${fieldName}フィールド発見: ${pattern} = ${rowData[pattern]}`);
        return rowData[pattern];
      }
    }
    console.log(`${fieldName}フィールド未発見: パターン ${patterns.join(', ')} はヘッダーに存在しません`);
    return '';
  };

  // 必須フィールドの取得
  const rawDate = findHeaderValue(['日付', '年月日', 'Date'], '日付');
  const venue = findHeaderValue(['開催', '競馬場', '会場', 'Venue'], '開催');
  const raceNumber = findHeaderValue(['Ｒ', 'R', 'レース'], 'レース番号');
  const horseName = findHeaderValue(['馬名', 'HorseName'], '馬名');
  const pedigreeNumber = findHeaderValue(['血統登録番号', '血統番号', '登録番号'], '血統登録番号');
  
  // 日付の正規化処理
  let date = '';
  const normalizedRawDate = normalizeDigits(rawDate);
  
  if (normalizedRawDate.includes('.')) {
    // "2025. 8.10" のような形式
    const parts = normalizedRawDate.replace(/\s+/g, '').split('.');
    console.log('ドット区切りパーツ:', parts);
    if (parts.length >= 3) {
      const year = parts[0];
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      date = `${year}${month}${day}`;
    }
  } else if (normalizedRawDate.length === 6) {
    // "250810" のような形式
    date = `20${normalizedRawDate}`;
    console.log('6桁処理結果:', date);
  } else if (normalizedRawDate.length === 8) {
    // "20250810" のような形式
    date = normalizedRawDate;
    console.log('8桁処理結果:', date);
  }
  
  console.log('最終的な日付:', date);
  
  // 必須フィールドのチェック
  if (!date || !venue || !raceNumber || !horseName || !pedigreeNumber) {
    return null;
  }
  
  // IDの生成
  const horseId = generateHorseId(pedigreeNumber);
  const raceId = generateRaceIdFromData(date, venue, raceNumber);
  const entryId = `${raceId}_${horseId}`;
  
  // 出馬表データの抽出
  const horseNo = parseInt(normalizeDigits(findHeaderValue(['馬番', 'HorseNo'], '馬番'))) || 1;
  const age = parseInt(normalizeDigits(findHeaderValue(['年齢', 'Age'], '年齢'))) || 3;
  const jockey = findHeaderValue(['騎手', 'Jockey'], '騎手') || '';
  const weight = parseFloat(normalizeDigits(findHeaderValue(['斤量', 'Weight'], '斤量')).replace(/[^\d.]/g, '')) || 54.0;
  const trainer = findHeaderValue(['調教師', 'Trainer'], '調教師') || '';
  const affiliation = findHeaderValue(['所属', 'Affiliation'], '所属') || '';
  const popularity = parseInt(normalizeDigits(findHeaderValue(['人気', 'Popularity'], '人気'))) || undefined;
  const bodyWeight = parseInt(normalizeDigits(findHeaderValue(['馬体重', 'BodyWeight'], '馬体重'))) || undefined;
  const bodyWeightDiff = parseInt(normalizeDigits(findHeaderValue(['馬体重増減', 'BodyWeightDiff'], '馬体重増減'))) || undefined;
  const blinkers = findHeaderValue(['ブリンカー', 'Blinkers'], 'ブリンカー') ? true : false;
  
  // 枠番の計算（馬番から推定）
  const frameNo = horseNo <= 8 ? horseNo : Math.ceil(horseNo / 2);
  
  return {
    id: entryId,
    raceId,
    horseId,
    frameNo,
    horseNo,
    age,
    jockey,
    weight,
    trainer,
    affiliation,
    popularity,
    bodyWeight,
    bodyWeightDiff,
    blinkers,
    date
  };
}

// Extract and deduplicate race entries from multiple CSV rows
export function extractRaceEntriesFromCsvData(
  headers: string[],
  csvRows: string[][]
): RaceEntryDataFromCsv[] {
  const entriesMap = new Map<string, RaceEntryDataFromCsv>();

  csvRows.forEach((values, index) => {
    try {
      const entryData = extractRaceEntryFromCsvData(headers, values);
      if (entryData) {
        entriesMap.set(entryData.id, entryData);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '不明なエラー';
      console.error(`行 ${index + 1}: 出馬表データの抽出に失敗しました - ${errorMessage}`, error);
    }
  });
  
  return Array.from(entriesMap.values());
}
