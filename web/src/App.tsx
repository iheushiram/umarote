import { ThemeProvider, createTheme, CssBaseline, Container } from '@mui/material'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HorseDetail from './pages/HorseDetail'
import HorseResultsPage from './pages/HorseResultsPage'
import HorseRacingTable from './components/HorseRacingTable'
import TopPage from './pages/TopPage'
import RaceResultsPage from './pages/RaceResultsPage'
import AdminPage from './pages/AdminPage'
import MoisturePerformancePage from './pages/MoisturePerformancePage'
import MoistureRacePerformancePage from './pages/MoistureRacePerformancePage'

const queryClient = new QueryClient()
const theme = createTheme()

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <Router>
          <Routes>
            <Route path="/" element={<Container maxWidth="lg" sx={{ py: 4 }}><TopPage /></Container>} />
            <Route path="/races/:raceId" element={<HorseRacingTable />} />
            <Route path="/races/:raceId/results" element={<Container maxWidth="lg" sx={{ py: 4 }}><RaceResultsPage /></Container>} />
            <Route path="/horse/:id" element={<Container maxWidth="lg" sx={{ py: 4 }}><HorseDetail /></Container>} />
            <Route path="/horse/:id/results" element={<Container maxWidth="lg" sx={{ py: 4 }}><HorseResultsPage /></Container>} />
            <Route path="/analysis/moisture" element={<Container maxWidth="lg" sx={{ py: 4 }}><MoisturePerformancePage /></Container>} />
            <Route path="/analysis/moisture/races" element={<Container maxWidth="lg" sx={{ py: 4 }}><MoistureRacePerformancePage /></Container>} />
            <Route path="/admin" element={<Container maxWidth="lg" sx={{ py: 4 }}><AdminPage /></Container>} />
          </Routes>
        </Router>
      </QueryClientProvider>
    </ThemeProvider>
  )
}

export default App


