import React from 'react';
import {
  Typography,
  Box,
  Tab,
  Tabs,
  Card,
  CardContent,
  Chip,
  Button,
  IconButton,
  Stack,
  FormControl,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Paper
} from '@mui/material';
import { ChevronLeft, ChevronRight, CalendarDays, Cloud, Sun } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { VenueBoard, Race } from '../types/horse';
import { getAvailableDates, getRacesByDate, getRaceEntriesByDate } from '../services/horseService';
import { RaceData } from '../services/adminService';

const today = new Date().toISOString().split('T')[0];

interface DateTabsProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
}

const DateTabs = ({ selectedDate, onDateChange }: DateTabsProps) => {
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAvailableDates = async () => {
      setLoading(true);
      setError(null);
      try {
        const dates = await getAvailableDates();
        console.log('=== DateTabs デバッグ ===');
        console.log('取得した日付:', dates);
        console.log('現在のselectedDate:', selectedDate);
        setAvailableDates(dates);
        
        // If no date is selected or selected date is not available, select the first available date
        if (dates.length > 0 && (!selectedDate || !dates.includes(selectedDate))) {
          console.log('最初の日付を選択:', dates[0]);
          onDateChange(dates[0]);
        }
      } catch (err) {
        console.error('Failed to load available dates:', err);
        setError('開催日の読み込みに失敗しました');
        // Fallback to current date if API fails
        setAvailableDates([today]);
        if (!selectedDate) {
          onDateChange(today);
        }
      } finally {
        setLoading(false);
      }
    };

    loadAvailableDates();
  }, [selectedDate, onDateChange]);

  if (loading) {
    return (
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error && availableDates.length === 0) {
    return (
      <Box sx={{ mb: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  // 有効な日付のみをフィルタリングしてマッピング
  const isValidDate = (dateStr: string): boolean => {
    if (!dateStr || typeof dateStr !== 'string') return false;
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date.getTime());
  };

  const dates = availableDates
    .filter(isValidDate)
    .map(dateStr => {
      const date = new Date(dateStr);
      const dayOfWeek = date.getDay();
      const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
      return {
        value: dateStr,
        label: `${date.getMonth() + 1}/${date.getDate()} (${dayNames[dayOfWeek]})`,
        isToday: dateStr === today,
        isSaturday: dayOfWeek === 6,
        isSunday: dayOfWeek === 0
      };
    });

  return (
    <Box sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
      <Tabs 
        value={selectedDate} 
        onChange={(_, value) => onDateChange(value)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ width: '100%' }}
      >
        {dates.map((date) => (
          <Tab 
            key={date.value}
            label={
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" sx={{ 
                  fontWeight: date.isToday ? 'bold' : 'normal',
                  color: date.isSaturday ? 'info.main' : 
                         date.isSunday ? 'error.main' : 'inherit'
                }}>
                  {date.label}
                </Typography>
                {date.isToday && (
                  <Typography variant="caption" color="primary.main">
                    今日
                  </Typography>
                )}
              </Box>
            } 
            value={date.value}
            sx={{
              minWidth: 80,
              '&.Mui-selected': {
                backgroundColor: 'transparent',
                color: 'primary.main',
                border: '2px solid',
                borderColor: 'primary.main',
                borderRadius: 1
              }
            }}
          />
        ))}
      </Tabs>
    </Box>
  );
};

interface RaceCardProps {
  race: RaceData;
  entries?: any[];
  onClick: (raceId: string) => void;
}

const RaceCard = ({ race, entries, onClick }: RaceCardProps) => {
  console.log(`=== RaceCard デバッグ ===`);
  console.log(`Race ID: ${race.raceId}`);
  console.log(`Entries:`, entries);
  console.log(`Entries length:`, entries?.length);
  const getGradeColor = (grade?: string) => {
    switch (grade) {
      case 'G1': return 'secondary';
      case 'G2': return 'info'; 
      case 'G3': return 'success';
      case 'OP': return 'warning';
      default: return 'default';
    }
  };

  const getGradeLabel = (grade?: string) => {
    switch (grade) {
      case 'G1': return 'GI';
      case 'G2': return 'GII';
      case 'G3': return 'GIII';
      case 'OP': return 'OP';
      default: return '';
    }
  };

  return (
    <Box 
      sx={{ 
        display: 'flex',
        alignItems: 'center',
        p: 1,
        borderBottom: '1px solid',
        borderColor: 'divider',
        cursor: 'pointer',
        '&:hover': { bgcolor: 'action.hover' },
        '&:last-child': { borderBottom: 'none' }
      }}
      onClick={() => onClick(race.raceId)}
    >
      {/* レース番号ボタン */}
      <Button
        variant="contained"
        size="small"
        sx={{
          minWidth: 'auto',
          width: 40,
          height: 32,
          borderRadius: 2,
          mr: 1,
          fontSize: '0.75rem',
          fontWeight: 'bold',
          bgcolor: 'primary.main',
          color: 'white',
          '&:hover': {
            bgcolor: 'primary.dark'
          }
        }}
      >
        {race.raceNo < 10 ? race.raceNo : race.raceNo.toString().padStart(2, '0')}R
      </Button>

      {/* レース情報 */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
          <Typography 
            variant="body2" 
            sx={{ 
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {race.raceName}
          </Typography>
          
          {/* グレードチップ */}
          {race.grade && (
            <Chip 
              label={getGradeLabel(race.grade)} 
              size="small" 
              color={getGradeColor(race.grade)}
              sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
            />
          )}
        </Box>
        
        <Typography variant="caption" color="text.secondary">
          {race.offAt || '00:00'} {race.surface}{race.distance}m {entries?.length || race.fieldSize || 0}頭
        </Typography>
        
        {/* 出馬表情報のプレビュー */}
        {entries && entries.length > 0 && (
          <Box sx={{ mt: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              出走馬: {entries.slice(0, 3).map(entry => entry.horse?.name || '不明').join(', ')}
              {entries.length > 3 && `...他${entries.length - 3}頭`}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

interface VenueColumnProps {
  venue: string;
  meetStr: string;
  races: RaceData[];
  entries: Record<string, { entries: any[], raceInfo: any }>;
  weather?: string;
  trackCond?: string;
  onRaceClick: (raceId: string) => void;
}

const VenueColumn = ({ venue, meetStr, races, entries, weather, trackCond, onRaceClick }: VenueColumnProps) => {
  const getWeatherIcon = (weather?: string) => {
    if (!weather) return <Sun size={16} />;
    if (weather.includes('曇') || weather.includes('雨')) return <Cloud size={16} />;
    return <Sun size={16} />;
  };

  return (
    <Paper sx={{ height: 'fit-content', p: 2 }}>
      {/* ヘッダー */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
          {meetStr}
        </Typography>
        
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="caption">天気:</Typography>
            {getWeatherIcon(weather)}
          </Box>
          
          <Chip 
            label={`芝(A): ${trackCond || '良'}`} 
            size="small" 
            variant="outlined"
            sx={{ fontSize: '0.7rem' }}
          />
          
          <Chip 
            label={`ダ:${trackCond || '良'}`} 
            size="small" 
            variant="outlined"
            sx={{ fontSize: '0.7rem' }}
          />
        </Stack>
      </Box>
      
      {/* レース一覧 */}
      <Stack spacing={0}>
        {races.map((race) => (
          <RaceCard 
            key={race.raceId} 
            race={race} 
            entries={entries?.[race.raceId]?.entries}
            onClick={onRaceClick}
          />
        ))}
      </Stack>
    </Paper>
  );
};

export default function TopPage() {
  const [selectedDate, setSelectedDate] = useState('');
  const [surfaceFilter, setSurfaceFilter] = useState<'all' | 'turf' | 'dirt'>('all');
  const [gradeFilter, setGradeFilter] = useState<'all' | 'stakes' | 'graded'>('all');
  const [races, setRaces] = useState<RaceData[]>([]);
  const [raceEntries, setRaceEntries] = useState<Record<string, { entries: any[], raceInfo: any }>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  
  console.log('=== TopPage 初期化デバッグ ===');
  console.log('selectedDate:', selectedDate);
  console.log('races length:', races.length);
  console.log('raceEntries keys:', Object.keys(raceEntries));

  // 会場名の変換マッピング
  const venueMapping: Record<string, string> = {
    '札': '札幌',
    '函': '函館',
    '新': '新潟',
    '東': '東京',
    '中': '中山',
    '京': '京都',
    '阪': '阪神',
    '小': '小倉'
  };

  const getFullVenueName = (shortName: string): string => {
    return venueMapping[shortName] || shortName;
  };

  // Load races and entries when date changes
  useEffect(() => {
    console.log('=== useEffect 実行デバッグ ===');
    console.log('selectedDate:', selectedDate);
    console.log('selectedDate truthy:', !!selectedDate);
    
    if (!selectedDate) { 
      console.log('selectedDateが空のため処理をスキップ');
      setLoading(false);
      return;
    }

    const loadRacesAndEntries = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log('Selected date:', selectedDate);
        
        // まずレース情報を取得
        const raceData = await getRacesByDate(selectedDate);
        console.log('=== トップページデバッグ ===');
        console.log('選択日付:', selectedDate);
        console.log('Race data:', raceData);
        
        // レース情報が取得できた場合のみ出馬表を取得
        if (raceData.length > 0) {
          const entriesData = await getRaceEntriesByDate(selectedDate);
          console.log('Entries data:', entriesData);
          console.log('Entries data keys:', Object.keys(entriesData));
          setRaceEntries(entriesData);
        } else {
          console.log('レースデータが空のため出馬表は取得しません');
          setRaceEntries({});
        }
        
        setRaces(raceData);
      } catch (err) {
        console.error('Failed to load races and entries:', err);
        setError('レース情報の読み込みに失敗しました');
        setRaces([]);
        setRaceEntries({});
      } finally {
        setLoading(false);
      }
    };

    loadRacesAndEntries();
  }, [selectedDate]);

  const handleRaceClick = (raceId: string) => {
    navigate(`/races/${raceId}`);
  };

  const filteredRaces = races.filter(race => {
    if (surfaceFilter !== 'all' && 
        ((surfaceFilter === 'turf' && race.surface !== '芝') ||
         (surfaceFilter === 'dirt' && race.surface !== 'ダート'))) {
      return false;
    }
    
    if (gradeFilter === 'stakes' && !race.grade) return false;
    if (gradeFilter === 'graded' && (!race.grade || race.grade === 'OP')) return false;
    
    return true;
  });

  // 会場ごとにレースをグループ化
  const racesByVenue = filteredRaces.reduce((acc, race) => {
    const venueKey = race.venue;
    const fullVenueName = getFullVenueName(race.venue);
    if (!acc[venueKey]) {
      acc[venueKey] = {
        venue: fullVenueName,
        meetStr: `${race.meetingNumber}回 ${fullVenueName} ${race.dayNumber}日目`,
        races: []
      };
    }
    acc[venueKey].races.push(race);
    return acc;
  }, {} as Record<string, { venue: string; meetStr: string; races: RaceData[] }>);

  // レース番号順にソート
  Object.values(racesByVenue).forEach(venue => {
    venue.races.sort((a, b) => a.raceNo - b.raceNo);
  });

  return (
    <Box>
      <Typography variant="h4" component="h1" sx={{ mb: 3, fontWeight: 'bold' }}>
        競馬開催情報
      </Typography>
      
      {/* 日付選択 */}
      <DateTabs selectedDate={selectedDate} onDateChange={setSelectedDate} />
      
      {/* クイックフィルタ */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap">
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <Select
            value={surfaceFilter}
            onChange={(e) => setSurfaceFilter(e.target.value as 'all' | 'turf' | 'dirt')}
          >
            <MenuItem value="all">芝・ダート</MenuItem>
            <MenuItem value="turf">芝のみ</MenuItem>
            <MenuItem value="dirt">ダートのみ</MenuItem>
          </Select>
        </FormControl>
        
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <Select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value as 'all' | 'stakes' | 'graded')}
          >
            <MenuItem value="all">全レース</MenuItem>
            <MenuItem value="stakes">重賞のみ</MenuItem>
            <MenuItem value="graded">G1-G3のみ</MenuItem>
          </Select>
        </FormControl>
      </Stack>
      
      {/* ローディング表示 */}
      {loading && (
        <Box textAlign="center" sx={{ mt: 4 }}>
          <CircularProgress />
          <Typography variant="body2" sx={{ mt: 2 }}>
            レース情報を読み込み中...
          </Typography>
        </Box>
      )}

      {/* エラー表示 */}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {/* レース一覧 */}
      {!loading && !error && selectedDate && (
        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: { 
            xs: '1fr', 
            md: 'repeat(3, 1fr)' 
          }, 
          gap: 3 
        }}>
          {Object.values(racesByVenue).map((venue) => (
            <VenueColumn 
              key={venue.venue}
              venue={venue.venue}
              meetStr={venue.meetStr}
              races={venue.races}
              entries={raceEntries}
              weather="晴"
              trackCond="良"
              onRaceClick={handleRaceClick}
            />
          ))}
        </Box>
      )}
      
      {!loading && !error && selectedDate && filteredRaces.length === 0 && (
        <Box textAlign="center" sx={{ mt: 4 }}>
          <Typography variant="h6" color="text.secondary">
            該当するレースがありません
          </Typography>
        </Box>
      )}
    </Box>
  );
}