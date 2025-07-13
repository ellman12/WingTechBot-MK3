import { Routes, Route } from 'react-router-dom'
import { createTheme } from '@mui/material/styles'
import { ThemeProvider as MuiThemeProvider, CssBaseline, Box } from '@mui/material'
import Sidebar from './components/Sidebar'
import HomePage from './pages/HomePage'
import MarkdownPage from './components/MarkdownPage'
import { getRoutes } from './config/content'
import { ThemeProvider } from './contexts/ThemeContext'
import { useTheme } from './hooks/useTheme'

// Create Material-UI theme
const createAppTheme = (isDarkMode: boolean) => createTheme({
  palette: {
    mode: isDarkMode ? 'dark' : 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: isDarkMode ? '#121212' : '#f5f5f5',
      paper: isDarkMode ? '#1e1e1e' : '#ffffff',
    },
    text: {
      primary: isDarkMode ? '#ffffff' : '#000000',
      secondary: isDarkMode ? '#b0b0b0' : '#666666',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 500,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff',
          border: isDarkMode ? '1px solid #333' : '1px solid #e0e0e0',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff',
          border: isDarkMode ? '1px solid #333' : '1px solid #e0e0e0',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff',
          borderRight: isDarkMode ? '1px solid #333' : '1px solid #e0e0e0',
        },
      },
    },
  },
})

function AppContent() {
  const { isDarkMode } = useTheme()
  const theme = createAppTheme(isDarkMode)

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
        {/* Sidebar */}
        <Sidebar />
        
        {/* Main content */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            ml: { lg: '256px' }, // 256px = sidebar width
            minHeight: '100vh',
          }}
        >
          <Routes>
            <Route path="/" element={<HomePage />} />
            {getRoutes().map(({ path, id }) => (
              <Route key={id} path={path} element={<MarkdownPage />} />
            ))}
          </Routes>
        </Box>
      </Box>
    </MuiThemeProvider>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  )
}

export default App 