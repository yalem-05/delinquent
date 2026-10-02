import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Box, GlobalStyles } from '@mui/material';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

const DashboardLayout = ({ menu, title, isMobile }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(true);
  const [hovered, setHovered] = useState(false);
  const navigate = useNavigate();

  const isExpanded = !desktopCollapsed || hovered;
  const sidebarWidth = isExpanded ? 240 : 72;

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <>
      {/* Global scrollbar styles */}
      <GlobalStyles
        styles={{
          '*::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '*::-webkit-scrollbar-track': {
            backgroundColor: '#f5f5f5',
            borderRadius: '4px',
          },
          '*::-webkit-scrollbar-thumb': {
            backgroundColor: '#DAA520',
            borderRadius: '4px',
            '&:hover': {
              backgroundColor: '#B8860B',
            },
          },
        }}
      />
      
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f5f5f5' }}>
        {/* Sidebar - FLOATING */}
        <Box
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <Sidebar
            menu={menu}
            isMobile={isMobile}
            mobileOpen={mobileOpen}
            setMobileOpen={setMobileOpen}
            desktopCollapsed={desktopCollapsed}
            setDesktopCollapsed={setDesktopCollapsed}
            hovered={hovered}
            setHovered={setHovered}
            onLogout={handleLogout}
          />
        </Box>

        {/* Main Content */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            width: '100%',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
          }}
        >
          <TopBar
            title={title}
            isMobile={isMobile}
            onMenuClick={() => setMobileOpen(true)}
            sidebarWidth={sidebarWidth}
            onLogout={handleLogout}
          />
          <Box
            sx={{
              p: 0,
              flexGrow: 1,
              ml: isMobile ? 0 : `${sidebarWidth}px`,
              width: isMobile ? '100%' : `calc(100% - ${sidebarWidth}px)`,
              transition: 'margin-left 0.25s ease-in-out, width 0.25s ease-in-out',
            }}
          >
            <Outlet />
          </Box>
        </Box>
      </Box>
    </>
  );
};

export default DashboardLayout;