import { ThemeProvider, createTheme, CssBaseline, Container } from '@mui/material'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HorseDetail from './pages/HorseDetail'
import HorseResultsPage from './pages/HorseResultsPage'
import HorseRacingTable from './components/HorseRacingTable'
import TopPage from './pages/TopPage'
import RaceResultsPage from './pages/RaceResultsPage'
import AdminPage from './pages/AdminPage'

const queryClient = new QueryClient()
const theme = createTheme()

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <Router>
          <Container maxWidth="lg" sx={{ py: 4 }}>
            <Routes>
              <Route path="/" element={<TopPage />} />
              <Route path="/races/:raceId" element={<HorseRacingTable />} />
              <Route path="/races/:raceId/results" element={<RaceResultsPage />} />
              <Route path="/horse/:id" element={<HorseDetail />} />
              <Route path="/horse/:id/results" element={<HorseResultsPage />} />
              <Route path="/admin" element={<AdminPage />} />
            </Routes>
          </Container>
        </Router>
      </QueryClientProvider>
    </ThemeProvider>
  )
}

export default App
