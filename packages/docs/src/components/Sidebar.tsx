import { NavLink } from 'react-router-dom'
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  useTheme as useMuiTheme,
  useMediaQuery,
  IconButton,
  Tooltip,
} from '@mui/material'
import {
  Home,
  Code,
  AccountTree,
  LightMode,
  DarkMode,
} from '@mui/icons-material'
import { useTheme } from '../hooks/useTheme'
import { getSidebarNavigation } from '../config/content'

type SidebarProps = {
  onClose?: () => void
}

const navigation = [
  { name: 'Overview', href: '/', icon: Home },
  { name: 'API Reference', href: '/api', icon: Code },
  { name: 'Architecture', href: '/architecture', icon: AccountTree },
]

export default function Sidebar({ onClose }: SidebarProps) {
  const muiTheme = useMuiTheme()
  const { isDarkMode, toggleTheme } = useTheme()
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('lg'))

  const drawerContent = (
    <Box sx={{ width: 256, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Box>
            <Typography variant="h6" component="h1" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
              WingTechBot MK3
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              Developer Documentation
            </Typography>
          </Box>
          <Tooltip title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
            <IconButton
              onClick={toggleTheme}
              size="small"
              sx={{ color: 'text.secondary' }}
            >
              {isDarkMode ? <LightMode /> : <DarkMode />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Navigation */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        <List sx={{ py: 0 }}>
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <ListItem key={item.name} disablePadding>
                <NavLink
                  to={item.href}
                  style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}
                  onClick={onClose}
                >
                  {({ isActive }) => (
                    <ListItemButton
                      sx={{
                        backgroundColor: isActive ? 'primary.50' : 'transparent',
                        color: isActive ? 'primary.main' : 'text.primary',
                        '&:hover': {
                          backgroundColor: isActive ? 'primary.100' : 'action.hover',
                        },
                      }}
                    >
                      <ListItemIcon sx={{ color: 'inherit' }}>
                        <Icon />
                      </ListItemIcon>
                      <ListItemText primary={item.name} />
                    </ListItemButton>
                  )}
                </NavLink>
              </ListItem>
            )
          })}
        </List>

        <Divider sx={{ my: 2 }} />

        {/* Dynamic Navigation from Content Config */}
        {getSidebarNavigation().map((category) => (
          <Box key={category.name}>
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 'bold' }}>
                {category.name}
              </Typography>
            </Box>
            <List sx={{ py: 0 }}>
              {category.items.map((item) => (
                <ListItem key={item.id} disablePadding>
                  <NavLink
                    to={item.path}
                    style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}
                    onClick={onClose}
                  >
                    {({ isActive }) => (
                      <ListItemButton
                        sx={{
                          pl: 4,
                          backgroundColor: isActive ? 'primary.50' : 'transparent',
                          color: isActive ? 'primary.main' : 'text.primary',
                          '&:hover': {
                            backgroundColor: isActive ? 'primary.100' : 'action.hover',
                          },
                        }}
                      >
                        <ListItemText primary={item.title} />
                      </ListItemButton>
                    )}
                  </NavLink>
                </ListItem>
              ))}
            </List>
            <Divider sx={{ my: 2 }} />
          </Box>
        ))}
      </Box>

      {/* Footer */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
          Released under the MIT License
        </Typography>
        <Typography
          component="a"
          href="https://github.com/ellman12/WingTechBot-MK3"
          target="_blank"
          rel="noopener noreferrer"
          variant="caption"
          sx={{
            color: 'primary.main',
            textDecoration: 'none',
            '&:hover': { textDecoration: 'underline' },
            display: 'block',
            mt: 0.5,
          }}
        >
          View on GitHub
        </Typography>
      </Box>
    </Box>
  )

  if (isMobile) {
    return (
      <Drawer
        variant="temporary"
        open={true}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          '& .MuiDrawer-paper': { width: 256 },
        }}
      >
        {drawerContent}
      </Drawer>
    )
  }

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: 256,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: 256,
          boxSizing: 'border-box',
          borderRight: 1,
          borderColor: 'divider',
        },
      }}
    >
      {drawerContent}
    </Drawer>
  )
} 