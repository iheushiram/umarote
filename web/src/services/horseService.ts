import { HorseWithResults } from '../types/horse';

const sampleHorses: HorseWithResults[] = [
  {
    id: '1',
    name: 'ディープインパクト',
    birthYear: 2002,
    sex: '牡',
    color: '鹿毛',
    father: 'サンデーサイレンス',
    mother: 'ウインドインハーヘア',
    trainer: '池江泰郎',
    owner: '金子真人ホールディングス',
    breeder: 'ノーザンファーム',
    earnings: 1452540000,
    results: [
      {
        id: '1-1',
        date: '2005-05-22',
        raceName: '日本ダービー(G1)',
        venue: '東京',
        courseType: '芝',
        distance: 2400,
        direction: '左',
        weather: '晴',
        courseCondition: '良',
        cushionValue: 9.2,
        finishPosition: 1,
        jockey: '武豊',
        weight: 456,
        time: '2:23.3',
        margin: '1 1/2',
        averagePosition: 2.5,
        lastThreeFurlong: '33.8',
        odds: 1.7,
        popularity: 1
      },
      {
        id: '1-2',
        date: '2005-10-30',
        raceName: '菊花賞(G1)',
        venue: '京都',
        courseType: '芝',
        distance: 3000,
        direction: '右',
        weather: '晴',
        courseCondition: '良',
        cushionValue: 8.8,
        finishPosition: 1,
        jockey: '武豊',
        weight: 458,
        time: '3:04.0',
        margin: '2',
        averagePosition: 2.0,
        lastThreeFurlong: '34.2',
        odds: 1.2,
        popularity: 1
      }
    ]
  },
  {
    id: '2',
    name: 'オルフェーヴル',
    birthYear: 2008,
    sex: '牡',
    color: '栗毛',
    father: 'ステイゴールド',
    mother: 'オリエンタルアート',
    trainer: '池江泰寿',
    owner: 'サンデーレーシング',
    breeder: '追分ファーム',
    earnings: 1576213000,
    results: [
      {
        id: '2-1',
        date: '2011-05-22',
        raceName: '日本ダービー(G1)',
        venue: '東京',
        courseType: '芝',
        distance: 2400,
        direction: '左',
        weather: '晴',
        courseCondition: '良',
        cushionValue: 9.1,
        finishPosition: 1,
        jockey: '池添謙一',
        weight: 480,
        time: '2:23.7',
        margin: '3',
        averagePosition: 3.0,
        lastThreeFurlong: '33.5',
        odds: 2.7,
        popularity: 1
      }
    ]
  }
];

export const getHorses = (): Promise<HorseWithResults[]> => {
  return Promise.resolve(sampleHorses);
};