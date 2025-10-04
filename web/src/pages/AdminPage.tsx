import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Paper,
  Tabs,
  Tab,
} from '@mui/material';
import { Upload, Database, FileText, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import HorseCsvUpload from '../components/admin/HorseCsvUpload';
import RaceCsvUpload from '../components/admin/RaceCsvUpload';
import RaceResultCsvUpload from '../components/admin/RaceResultCsvUpload';
import RaceEntryCsvUpload from '../components/admin/RaceEntryCsvUpload';
import TrainingCsvUpload from '../components/admin/TrainingCsvUpload';
import TrackConditionSummaryCsvUpload from '../components/admin/TrackConditionSummaryCsvUpload';
import TrackConditionManualForm from '../components/admin/TrackConditionManualForm';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `admin-tab-${index}`,
    'aria-controls': `admin-tabpanel-${index}`,
  };
}

export default function AdminPage() {
  const [tabValue, setTabValue] = useState(0);
  const navigate = useNavigate();

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
          管理画面
        </Typography>
        <Button
          variant="outlined"
          startIcon={<Home size={16} />}
          onClick={() => navigate('/')}
          sx={{ minWidth: 120 }}
        >
          トップページ
        </Button>
      </Box>
      
      <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary' }}>
        CSVファイルをアップロードして馬券データを管理できます
      </Typography>

      <Paper sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="admin tabs">
            <Tab 
              label="馬情報" 
              icon={<FileText size={16} />} 
              iconPosition="start"
              {...a11yProps(0)} 
            />
            <Tab 
              label="レース情報" 
              icon={<Database size={16} />} 
              iconPosition="start"
              {...a11yProps(1)} 
            />
            <Tab label="レース結果" icon={<Upload size={16} />} iconPosition="start" {...a11yProps(2)} />
            <Tab label="出馬表" icon={<Upload size={16} />} iconPosition="start" {...a11yProps(3)} />
            <Tab label="調教" icon={<Upload size={16} />} iconPosition="start" {...a11yProps(4)} />
            <Tab label="馬場サマリー" icon={<Upload size={16} />} iconPosition="start" {...a11yProps(5)} />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <HorseCsvUpload />
        </TabPanel>
        
        <TabPanel value={tabValue} index={1}>
          <RaceCsvUpload />
        </TabPanel>
        
        <TabPanel value={tabValue} index={2}>
          <RaceResultCsvUpload />
        </TabPanel>
        <TabPanel value={tabValue} index={3}>
          <RaceEntryCsvUpload />
        </TabPanel>
        <TabPanel value={tabValue} index={4}>
          <TrainingCsvUpload />
        </TabPanel>
        <TabPanel value={tabValue} index={5}>
          <TrackConditionSummaryCsvUpload />
          <TrackConditionManualForm />
        </TabPanel>
      </Paper>
    </Box>
  );
}
