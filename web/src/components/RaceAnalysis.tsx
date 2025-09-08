import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material';
import { formatRaceTime } from '../utils/timeUtils';

interface AnalysisData {
  raceId: string;
  date: string;
  raceName: string;
  venue: string;
  surface: string;
  distance: number;
  time: string;
  finishPosition: number;
  courseCondition: string;
  weather?: string;
  pos1c?: number;
  pos2c?: number;
  pos3c?: number;
  pos4c?: number;
  horseName: string;
  weight: number;
  lastThreeFurlong: string;
}

interface DistanceStats {
  count: number;
  average: number;
  fastest: number;
  slowest: number;
  median: number;
}

interface DistanceAnalysisProps {
  raceId: string;
  currentDistance: number;
  currentSurface: string;
  currentVenue: string;
}

export default function DistanceAnalysis({ raceId, currentDistance, currentSurface, currentVenue }: DistanceAnalysisProps) {
  const [data, setData] = useState<AnalysisData[]>([]);
  const [stats, setStats] = useState<DistanceStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    surface: currentSurface,
    venue: currentVenue,
    limit: '50',
    class: 'all'
  });

  const fetchAnalysisData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        distance: currentDistance.toString(),
        surface: filters.surface,
        venue: filters.venue,
        limit: filters.limit,
        class: filters.class
      });

      const response = await fetch(`/api/analysis/distance-times?${params}`);
      if (!response.ok) {
        throw new Error('分析データの取得に失敗しました');
      }

      const result = await response.json();
      setData(result.results);
      setStats(result.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysisData();
  }, [currentDistance, filters]);

  const formatTime = (time: string | number): string => {
    const timeStr = String(time);
    if (timeStr.includes(':')) {
      return timeStr;
    } else {
      const seconds = parseFloat(timeStr);
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = (seconds % 60).toFixed(1);
      return `${minutes}:${remainingSeconds.padStart(4, '0')}`;
    }
  };

  const formatSeconds = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = (seconds % 60).toFixed(1);
    return `${minutes}:${remainingSeconds.padStart(4, '0')}`;
  };

  const formatPassingOrder = (pos1c?: number, pos2c?: number, pos3c?: number, pos4c?: number): string => {
    const positions = [pos1c, pos2c, pos3c, pos4c].filter(pos => pos !== null && pos !== undefined);
    if (positions.length === 0) return '-';
    return positions.join('-');
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        距離別過去時間分析 ({currentDistance}m)
      </Typography>

      {/* フィルター */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <Box sx={{ minWidth: 200, flex: '1 1 200px' }}>
            <FormControl fullWidth size="small">
              <InputLabel>コース種別</InputLabel>
              <Select
                value={filters.surface}
                label="コース種別"
                onChange={(e) => setFilters(prev => ({ ...prev, surface: e.target.value }))}
              >
                <MenuItem value="all">全て</MenuItem>
                <MenuItem value="芝">芝</MenuItem>
                <MenuItem value="ダート">ダート</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ minWidth: 200, flex: '1 1 200px' }}>
            <FormControl fullWidth size="small">
              <InputLabel>会場</InputLabel>
              <Select
                value={filters.venue}
                label="会場"
                onChange={(e) => setFilters(prev => ({ ...prev, venue: e.target.value }))}
              >
                <MenuItem value="all">全て</MenuItem>
                <MenuItem value="札幌">札幌</MenuItem>
                <MenuItem value="函館">函館</MenuItem>
                <MenuItem value="福島">福島</MenuItem>
                <MenuItem value="新潟">新潟</MenuItem>
                <MenuItem value="東京">東京</MenuItem>
                <MenuItem value="中山">中山</MenuItem>
                <MenuItem value="中京">中京</MenuItem>
                <MenuItem value="京都">京都</MenuItem>
                <MenuItem value="阪神">阪神</MenuItem>
                <MenuItem value="小倉">小倉</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ minWidth: 200, flex: '1 1 200px' }}>
            <FormControl fullWidth size="small">
              <InputLabel>クラス</InputLabel>
              <Select
                value={filters.class}
                label="クラス"
                onChange={(e) => setFilters(prev => ({ ...prev, class: e.target.value }))}
              >
                <MenuItem value="all">全て</MenuItem>
                <MenuItem value="G1">G1</MenuItem>
                <MenuItem value="G2">G2</MenuItem>
                <MenuItem value="G3">G3</MenuItem>
                <MenuItem value="OP">OP</MenuItem>
                <MenuItem value="L">L</MenuItem>
                <MenuItem value="3勝クラス">3勝クラス</MenuItem>
                <MenuItem value="2勝クラス">2勝クラス</MenuItem>
                <MenuItem value="1勝クラス">1勝クラス</MenuItem>
                <MenuItem value="新馬">新馬</MenuItem>
                <MenuItem value="未勝利">未勝利</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ minWidth: 200, flex: '1 1 200px' }}>
            <FormControl fullWidth size="small">
              <InputLabel>取得件数</InputLabel>
              <Select
                value={filters.limit}
                label="取得件数"
                onChange={(e) => setFilters(prev => ({ ...prev, limit: e.target.value }))}
              >
                <MenuItem value="20">20件</MenuItem>
                <MenuItem value="50">50件</MenuItem>
                <MenuItem value="100">100件</MenuItem>
                <MenuItem value="200">200件</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Box>
      </Paper>

      {/* 統計情報 */}
      {stats && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
          <Box sx={{ minWidth: 200, flex: '1 1 200px' }}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  分析件数
                </Typography>
                <Typography variant="h5">
                  {stats.count}件
                </Typography>
              </CardContent>
            </Card>
          </Box>
          <Box sx={{ minWidth: 200, flex: '1 1 200px' }}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  平均タイム
                </Typography>
                <Typography variant="h5">
                  {formatSeconds(stats.average)}
                </Typography>
              </CardContent>
            </Card>
          </Box>
          <Box sx={{ minWidth: 200, flex: '1 1 200px' }}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  最速タイム
                </Typography>
                <Typography variant="h5" color="success.main">
                  {formatSeconds(stats.fastest)}
                </Typography>
              </CardContent>
            </Card>
          </Box>
          <Box sx={{ minWidth: 200, flex: '1 1 200px' }}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  最遅タイム
                </Typography>
                <Typography variant="h5" color="error.main">
                  {formatSeconds(stats.slowest)}
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </Box>
      )}

      {/* データテーブル */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>日付</TableCell>
              <TableCell>レース名</TableCell>
              <TableCell>馬名</TableCell>
              <TableCell>体重</TableCell>
              <TableCell>馬場</TableCell>
              <TableCell>通過順</TableCell>
              <TableCell>上り3F</TableCell>
              <TableCell>タイム</TableCell>
              <TableCell>着順</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            )}
            {error && (
              <TableRow>
                <TableCell colSpan={9}>
                  <Alert severity="error">{error}</Alert>
                </TableCell>
              </TableRow>
            )}
            {!loading && !error && data.map((row, index) => (
              <TableRow key={index}>
                <TableCell>{row.date}</TableCell>
                <TableCell>{row.raceName}</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>{row.horseName}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace' }}>{row.weight}kg</TableCell>
                <TableCell>{row.courseCondition}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                  {formatPassingOrder(row.pos1c, row.pos2c, row.pos3c, row.pos4c)}
                </TableCell>
                <TableCell sx={{ fontFamily: 'monospace' }}>{row.lastThreeFurlong}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace' }}>
                  {formatTime(row.time)}
                </TableCell>
                <TableCell>
                  <Chip 
                    label={row.finishPosition} 
                    size="small" 
                    color={row.finishPosition <= 3 ? 'success' : 'default'}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
