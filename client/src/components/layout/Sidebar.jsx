import React, { useState } from 'react';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Typography,
  useTheme,
  Divider,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import { useNavigate, useLocation } from 'react-router-dom';

const Sidebar = ({
  menu,
  isMobile,
  mobileOpen,
  setMobileOpen,
  desktopCollapsed,
  setDesktopCollapsed,
  onLogout,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const [hovered, setHovered] = useState(false);

  // Desktop: 
  // - When collapsed=true: width is 72px (shrunk)
  // - When hovered on collapsed: expands to 240px
  // - When collapsed=false: always 240px (expanded)
  const isExpanded = !desktopCollapsed || hovered;
  const desktopWidth = isExpanded ? 240 : 72;
  const footerHeight = 65;

  const handleNavigation = (item) => {
    // Check if this is a logout item
    if (item.isLogout || item.name === "Logout" || item.path === "/logout") {
      if (onLogout) {
        onLogout();
      } else {
        // Fallback logout
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        navigate("/login");
      }
    } else {
      navigate(item.path);
    }
    
    if (isMobile) setMobileOpen(false);
  };

  const sidebarContent = (
    <Box
      onMouseEnter={() => {
        if (!isMobile && desktopCollapsed) {
          setHovered(true);
        }
      }}
      onMouseLeave={() => {
        if (!isMobile) {
          setHovered(false);
        }
      }}
      sx={{
        width: isMobile ? 260 : desktopWidth,
        height: '100%',
        bgcolor: '#000000',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        transition: isMobile ? 'none' : 'width 0.25s ease-in-out',
        overflow: 'hidden',
        borderRight: '1px solid #DAA520',
        boxShadow: '4px 0 12px rgba(0,0,0,0.5)',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: (isMobile || isExpanded) ? 'space-between' : 'center',
          p: 2,
          borderBottom: '1px solid #DAA520',
          minHeight: 63.5,
          height: 63.5,
        }}
      >
        {(isMobile || isExpanded) && (
          <Typography
            variant="h6"
            sx={{
              fontWeight: 'bold',
              color: '#DAA520',
              whiteSpace: 'nowrap',
              opacity: isExpanded ? 1 : 0,
              transition: 'opacity 0.2s ease',
            }}
          >
            ANBESA BANK
          </Typography>
        )}
        
        {!isMobile && (
          <IconButton
            onClick={() => {
              setDesktopCollapsed(!desktopCollapsed);
              setHovered(false);
            }}
            sx={{
              color: '#DAA520',
              '&:hover': { bgcolor: 'rgba(218, 165, 32, 0.1)' },
              transform: desktopCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
              transition: 'transform 0.3s ease',
            }}
          >
            <MenuIcon />
          </IconButton>
        )}
        
        {isMobile && (
          <IconButton
            onClick={() => setMobileOpen(false)}
            sx={{
              color: '#DAA520',
              '&:hover': { bgcolor: 'rgba(218, 165, 32, 0.1)' },
            }}
          >
            <ChevronLeftIcon />
          </IconButton>
        )}
      </Box>

      {/* Menu Items */}
      <List sx={{ flex: 1, py: 2, px: 1 }}>
        {menu.map((item) => {
          const isActive = location.pathname === item.path;
          const showText = isMobile || isExpanded;
          const isLogoutItem = item.isLogout || item.name === "Logout";

          return (
            <ListItem
              key={item.path || item.name}
              onClick={() => handleNavigation(item)}
              sx={{
                cursor: 'pointer',
                py: 1.2,
                px: 2,
                mb: 0.5,
                borderRadius: 2,
                backgroundColor: isActive && !isLogoutItem ? '#DAA520' : 'transparent',
                justifyContent: showText ? 'flex-start' : 'center',
                '&:hover': {
                  backgroundColor: isLogoutItem 
                    ? 'rgba(211, 47, 47, 0.2)' 
                    : (isActive ? '#DAA520' : 'rgba(218, 165, 32, 0.1)'),
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color: isLogoutItem 
                    ? '#ff4444' 
                    : (isActive ? '#000000' : '#DAA520'),
                  minWidth: showText ? 40 : 'auto',
                  justifyContent: 'center',
                }}
              >
                {item.icon}
              </ListItemIcon>
              {showText && (
                <ListItemText
                  primary={item.name}
                  primaryTypographyProps={{
                    sx: {
                      fontWeight: isActive && !isLogoutItem ? 600 : 400,
                      fontSize: '0.9rem',
                      whiteSpace: 'nowrap',
                      color: isLogoutItem 
                        ? '#ff4444' 
                        : (isActive && !isLogoutItem ? '#000000' : '#ffffff'),
                    },
                  }}
                />
              )}
            </ListItem>
          );
        })}
      </List>

      {/* Footer */}
      {(isMobile || isExpanded) && (
        <Box
          sx={{
            p: 2,
            borderTop: '1px solid #DAA520',
            textAlign: 'center',
            opacity: isExpanded ? 1 : 0,
            transition: 'opacity 0.2s ease',
            minHeight: footerHeight,
            height: footerHeight,
          }}
        >
          <Typography variant="caption" sx={{ color: '#DAA520' }}>
            © {new Date().getFullYear()} Anbesa Bank
          </Typography>
          <Typography variant="caption" sx={{ color: '#666', display: 'block', fontSize: '0.6rem' }}>
            delinquent list v1.0
          </Typography>
        </Box>
      )}
      
      {!isMobile && !isExpanded && (
        <Box
          sx={{
            p: 1,
            borderTop: '1px solid #DAA520',
            textAlign: 'center',
            minHeight: footerHeight,
            height: footerHeight,
          }}
        >
          <Typography variant="caption" sx={{ color: '#DAA520' }}>
            v1.0
          </Typography>
        </Box>
      )}
    </Box>
  );

  // Desktop: Fixed position - FLOATING
  if (!isMobile) {
    return (
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100vh',
          zIndex: 1200,
        }}
      >
        {sidebarContent}
      </Box>
    );
  }

  // Mobile: Drawer
  return (
    <Drawer
      anchor="left"
      open={mobileOpen}
      onClose={() => setMobileOpen(false)}
      sx={{
        '& .MuiDrawer-paper': {
          width: 260,
          bgcolor: '#000000',
          borderRight: '1px solid #DAA520',
        },
      }}
    >
      {sidebarContent}
    </Drawer>
  );
};

export default Sidebar;