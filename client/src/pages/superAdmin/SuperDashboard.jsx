// pages/admin/AdminDashboard.jsx
import React, { useState, useEffect } from "react";
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  useMediaQuery,
  useTheme,
  CircularProgress,
  Stack,
  Avatar,
} from "@mui/material";
import {
  Storage as StorageIcon,
  People as PeopleIcon,
  AccountBalance as AccountBalanceIcon,
  Dashboard as DashboardIcon,
  Public as PublicIcon,
  Gavel as GavelIcon,
  Security as SecurityIcon,
  List as ListIcon
} from "@mui/icons-material";
import axios from "axios";

const API_URL = `${import.meta.env.VITE_API_URL}/api/adminDashboard/stats`;

const StatCard = ({ title, value, icon, color = "#DAA520", subtitle }) => (
  <Card sx={{ bgcolor: "#fff", borderRadius: 2, boxShadow: 1, height: "100%" }}>
    <CardContent>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            {title}
          </Typography>
          <Typography variant="h4" fontWeight="bold" color={color}>
            {value?.toLocaleString() ?? "—"}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        <Avatar
          sx={{
            bgcolor: `${color}15`,
            width: 48,
            height: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </Avatar>
      </Stack>
    </CardContent>
  </Card>
);

const SectionTitle = ({ text, color = "#DAA520" }) => (
  <Typography
    variant="h6"
    fontWeight="bold"
    sx={{ mt: 3, mb: 2, color: color, borderLeft: `4px solid ${color}`, pl: 2 }}
  >
    {text}
  </Typography>
);

const SuperDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const getContainerMargin = () => {
    if (isMobile) return "0px";
    return "84px";
  };

  const getContainerWidth = () => {
    if (isMobile) return "100%";
    return "calc(100% - 96px)";
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        const response = await axios.get(API_URL, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log("Dashboard data:", response.data);
        setData(response.data.data);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "#f5f5f5", py: isMobile ? 1 : 2 }}>
        <Container
          maxWidth={false}
          sx={{
            width: "100%",
            ml: 0,
            mr: 0,
            px: { xs: 1, sm: 2, md: 0.5 },
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "400px",
          }}
        >
          <CircularProgress sx={{ color: "#DAA520" }} />
        </Container>
      </Box>
    );
  }

  if (!data) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "#f5f5f5", py: isMobile ? 1 : 2 }}>
        <Container
          maxWidth={false}
          sx={{
            width: "100%",
            ml: 0,
            mr: 0,
            px: { xs: 1, sm: 2, md: 0.5 },
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "400px",
          }}
        >
          <Typography color="error">No data available. Please check your connection.</Typography>
        </Container>
      </Box>
    );
  } const statsList = [
    { title: "Users", value: data.users, icon: <PeopleIcon sx={{ fontSize: 24, color: "#1976d2" }} />, color: "#1976d2" },
    { title: "International PEP", value: data.international_pep, icon: <PublicIcon sx={{ fontSize: 24, color: "#DAA520" }} />, color: "#DAA520" },
    { title: "UK Sanctions List", value: data.uk_sanctions, icon: <GavelIcon sx={{ fontSize: 24, color: "#d32f2f" }} />, color: "#d32f2f" },
    { title: "EU Sanctions", value: data.eu_sanctions, icon: <SecurityIcon sx={{ fontSize: 24, color: "#0288d1" }} />, color: "#0288d1" },
    { title: "OFAC Sanctions", value: data.ofac_sanctions, icon: <GavelIcon sx={{ fontSize: 24, color: "#2e7d32" }} />, color: "#2e7d32" },
    { title: "UN Sanctions", value: data.un_sanctions, icon: <PublicIcon sx={{ fontSize: 24, color: "#ed6c02" }} />, color: "#ed6c02" },
    { title: "UN Designated", value: data.un_designated, icon: <PublicIcon sx={{ fontSize: 24, color: "#9c27b0" }} />, color: "#9c27b0" },
    { title: "Black List", value: data.black_list, icon: <ListIcon sx={{ fontSize: 24, color: "#000000" }} />, color: "#000000" },
    { title: "Delinquent List", value: data.deliquent_list, icon: <AccountBalanceIcon sx={{ fontSize: 24, color: "#c62828" }} />, color: "#c62828" },
    { title: "ETH List", value: data.eth_list, icon: <ListIcon sx={{ fontSize: 24, color: "#1565c0" }} />, color: "#1565c0" },
    { title: "Local PEP", value: data.local_peps, icon: <PublicIcon sx={{ fontSize: 24, color: "#2e7d32" }} />, color: "#2e7d32" },
    { title: "PEP Adverser", value: data.pep_adverser, icon: <GavelIcon sx={{ fontSize: 24, color: "#d84315" }} />, color: "#d84315" },
  ];

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f5f5f5", py: isMobile ? 1 : 2 }}>
      <Container
        maxWidth={false}
        sx={{
          width: "100%",
          ml: 0,
          mr: 0,
          px: { xs: 1, sm: 2, md: 0.5 },
        }}
      >
        <Typography
          variant={isMobile ? "h5" : "h4"}
          fontWeight="bold"
          color="#DAA520"
          gutterBottom
          sx={{ mb: 3 }}
        >
          Admin Dashboard
        </Typography>

        <SectionTitle text="RECORD COUNTS" />
        <Grid container spacing={2}>
          {statsList.map((stat, idx) => (
            <Grid item xs={12} sm={6} md={3} key={idx}>
              <StatCard
                title={stat.title}
                value={stat.value}
                icon={stat.icon}
                color={stat.color}
              />
            </Grid>
          ))}
        </Grid>

        {/* Footer */}
        <Box sx={{ mt: 3, pt: 2, borderTop: "1px solid #e0e0e0", textAlign: "center" }}>
          <Typography variant="caption" color="text.secondary">
            © 2024 Anbesa Bank. All rights reserved.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default SuperDashboard;
