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

/**
 * 平均速度を計算（km/h）
 * @param distance - 距離（メートル）
 * @param time - タイム（数値: 1275 等 もしくは '1:27.5'）
 * @returns 平均速度（km/h、小数点1桁）
 */
export function calculateAverageSpeed(distance: number, time: string | number): number {
  if (!distance || distance <= 0) {
    return 0;
  }

  // time を秒に変換
  let secondsTotal = 0;
  if (typeof time === 'number') {
    // 例: 1275 -> 1分27秒5
    const minutes = Math.floor(time / 1000);
    const secTenth = time % 1000; // 例: 275
    const seconds = Math.floor(secTenth / 10); // 27
    const tenth = secTenth % 10; // 5
    secondsTotal = minutes * 60 + seconds + tenth / 10;
  } else if (typeof time === 'string' && time.includes(':')) {
    // 例: '1:27.5'
    const [m, s] = time.split(':');
    secondsTotal = (parseFloat(m) || 0) * 60 + (parseFloat(s) || 0);
  } else {
    const parsed = parseInt(time as string, 10);
    if (!isNaN(parsed)) {
      const minutes = Math.floor(parsed / 1000);
      const secTenth = parsed % 1000;
      const seconds = Math.floor(secTenth / 10);
      const tenth = secTenth % 10;
      secondsTotal = minutes * 60 + seconds + tenth / 10;
    }
  }

  if (secondsTotal <= 0) {
    return 0;
  }

  // 距離（m）÷ タイム（秒）× 3.6 = km/h
  const speed = (distance / secondsTotal) * 3.6;
  return Math.round(speed * 10) / 10; // 小数点1桁に丸める
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
  console.log('=== End Time Format Test ===');

  console.log('=== Average Speed Test ===');
  console.log('2000m, 1275 →', calculateAverageSpeed(2000, 1275), 'km/h'); // 59.5 km/h 相当
  console.log('1700m,  990 →', calculateAverageSpeed(1700, 990), 'km/h');  // 61.8 km/h 相当
  console.log('1200m,  690 →', calculateAverageSpeed(1200, 690), 'km/h');  // 62.6 km/h 相当
  console.log('1800m, 1439 →', calculateAverageSpeed(1800, 1439), 'km/h'); // 数値形式テスト
  console.log('=== End Average Speed Test ===');
}
