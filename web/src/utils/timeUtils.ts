/**
 * 競馬のタイム表示を変換するユーティリティ関数
 */

/**
 * 整数形式のタイムを「1:43.9」形式に変換
 * @param time - 整数形式のタイム（例：1439 → 1分43秒9）
 * @returns 変換後のタイム文字列
 */
export function formatRaceTime(time: string | number): string {
  if (!time || time === '') {
    return '';
  }

  // 数値に変換
  const timeNum = typeof time === 'string' ? parseInt(time, 10) : time;

  if (isNaN(timeNum) || timeNum <= 0) {
    return '';
  }

  // 1439の場合：
  // 1439の百の位（1）は分
  // 1439の十と一の位（43）は秒
  // 1439の一の位（9）は1/10秒
  const timeStr = timeNum.toString().padStart(4, '0');

  // 4桁に満たない場合は0埋め
  const paddedTime = timeStr.padStart(4, '0');

  // 分、秒、1/10秒に分解
  const minutes = parseInt(paddedTime.slice(-4, -3)) || 0; // 百の位
  const seconds = parseInt(paddedTime.slice(-3, -1)) || 0; // 十と一の位
  const tenthSeconds = parseInt(paddedTime.slice(-1)) || 0; // 一の位

  // 秒に小数点を追加
  const formattedSeconds = seconds + tenthSeconds / 10;

  // 0分または分がない場合は秒のみ表示
  if (minutes === 0) {
    return `${formattedSeconds.toFixed(1)}`;
  }

  return `${minutes}:${formattedSeconds.toFixed(1)}`;
}

/**
 * タイム文字列が有効かどうかをチェック
 * @param time - タイム文字列
 * @returns 有効なタイムかどうか
 */
export function isValidRaceTime(time: string | number): boolean {
  if (!time || time === '') {
    return false;
  }

  const timeNum = typeof time === 'string' ? parseInt(time, 10) : time;
  return !isNaN(timeNum) && timeNum > 0;
}

// テスト用の関数（開発時のみ使用）
if ((import.meta as any).env?.DEV) {
  console.log('=== Time Format Test ===');
  console.log('1439 →', formatRaceTime(1439)); // 1:43.9
  console.log('1500 →', formatRaceTime(1500)); // 2:30.0
  console.log('599 →', formatRaceTime(599));   // 59.9
  console.log('60 →', formatRaceTime(60));     // 6.0
  console.log('439 →', formatRaceTime(439));   // 43.9
  console.log('0 →', formatRaceTime(0));       // ''
  console.log('=== End Test ===');
}
