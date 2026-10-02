// pages/Landing.jsx
import React, { useState, useCallback, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { UserContext } from "../context/UserContext";

import {
  TextField,
  InputAdornment,
  IconButton,
  Button,
  Box,
  Avatar,
  Typography,
  Fade,
  Modal,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import LoginIcon from "@mui/icons-material/Login";
import CloseIcon from "@mui/icons-material/Close";
import PersonIcon from "@mui/icons-material/Person";
import KeyIcon from "@mui/icons-material/Key";
import ShieldIcon from "@mui/icons-material/Shield";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";

import { login } from "../api/authApi";

const Landing = () => {
  const navigate = useNavigate();
  const { setUser } = useContext(UserContext);

  // Login modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Single fixed slide
  const slide = {
    img: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1920&q=80",
    title: "SANCTIONS & WATCHLISTS",
    desc: "Cross-check applicants and counterparties against international sanctions and internal watchlists in real time.",
  };

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  // ---------- Handlers ----------
  const handleSearchClick = () => {
    navigate("/search");
  };

  const handleOpenLogin = () => {
    setModalOpen(true);
  };

  const handleCloseLogin = () => {
    if (loading) return;
    setModalOpen(false);
    setUsername("");
    setPassword("");
    setShowPassword(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await login({ username, password });

      if (res.error) {
        toast.error(res.error);
        setLoading(false);
        return;
      }
      if (!res.token) {
        toast.error("No token received from server");
        setLoading(false);
        return;
      }

      localStorage.setItem("token", res.token);

      const tokenPayload = JSON.parse(atob(res.token.split(".")[1]));

      const userData = {
        id: tokenPayload.id,
        name: tokenPayload.name,
        username: tokenPayload.username,
        role: tokenPayload.role,
        token: res.token,
        mustChangePassword: tokenPayload.mustChangePassword || false,
      };

      setUser(userData);

      if (tokenPayload.mustChangePassword) {
        toast.info("Please change your password before continuing.");
        setModalOpen(false);
        navigate("/change-password", { replace: true });
        return;
      }

      toast.success(`Welcome ${userData.name || userData.username}!`);

      const routes = {
        SUPER_ADMIN: "/superDashboard",
        ADMIN: "/dashboard",
      };
      const targetRoute = routes[tokenPayload.role] || "/dashboard";
      navigate(targetRoute, { replace: true });
      setModalOpen(false);
    } catch (error) {
      console.error("Login error:", error);
      toast.error(error.message || "Auth System Failure");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        minHeight: "100vh",
        overflow: "hidden",
        backgroundColor: "#111",
      }}
    >
      {/* ============================================== */}
      {/* BACKGROUND IMAGE (single fixed slide)          */}
      {/* ============================================== */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.75)), url(${slide.img})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />

      {/* ============================================== */}
      {/* TOP-RIGHT BUTTONS: Search + Login              */}
      {/* ============================================== */}
      <Box
        sx={{
          position: "absolute",
          top: { xs: 16, sm: 24, md: 32 },
          right: { xs: 16, sm: 24, md: 32 },
          zIndex: 20,
          display: "flex",
          gap: { xs: 1, sm: 1.5 },
        }}
      >
        <Button
          onClick={handleSearchClick}
          startIcon={<SearchIcon />}
          variant="outlined"
          sx={{
            color: "#fff",
            borderColor: "rgba(255,255,255,0.6)",
            borderRadius: "50px",
            px: { xs: 2, sm: 3 },
            py: 1,
            fontWeight: 700,
            textTransform: "none",
            fontSize: { xs: "0.75rem", sm: "0.9rem" },
            backdropFilter: "blur(10px)",
            backgroundColor: "rgba(255,255,255,0.08)",
            "&:hover": {
              borderColor: "#DAA520",
              color: "#DAA520",
              backgroundColor: "rgba(218, 165, 32, 0.1)",
            },
          }}
        >
          Search
        </Button>

        <Button
          onClick={handleOpenLogin}
          startIcon={<LoginIcon />}
          variant="contained"
          sx={{
            color: "#000",
            backgroundColor: "#DAA520",
            borderRadius: "50px",
            px: { xs: 2, sm: 3 },
            py: 1,
            fontWeight: 800,
            textTransform: "none",
            fontSize: { xs: "0.75rem", sm: "0.9rem" },
            boxShadow: "0 8px 22px rgba(218, 165, 32, 0.35)",
            "&:hover": { backgroundColor: "#B8860B" },
          }}
        >
          Login
        </Button>
      </Box>

      {/* ============================================== */}
      {/* TOP-LEFT BRAND                                 */}
      {/* ============================================== */}
      <Box
        sx={{
          position: "absolute",
          top: { xs: 20, sm: 28, md: 36 },
          left: { xs: 20, sm: 28, md: 36 },
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <Avatar
          sx={{
            width: { xs: 40, sm: 46 },
            height: { xs: 40, sm: 46 },
            border: "2px solid #DAA520",
            background: "#DAA520",
            color: "#000",
            fontWeight: "bold",
            fontSize: { xs: "0.9rem", sm: "1rem" },
          }}
        >
          አንበሳ
        </Avatar>
        <Box sx={{ display: { xs: "none", sm: "block" } }}>
          <Typography
            sx={{
              color: "#fff",
              fontWeight: 900,
              letterSpacing: 3,
              fontSize: "0.8rem",
            }}
          >
            ANBESA BANK S.C.
          </Typography>
          <Typography
            sx={{
              color: "#DAA520",
              fontWeight: 600,
              letterSpacing: 2,
              fontSize: "0.65rem",
            }}
          >
            DELINQUENT SCREENING
          </Typography>
        </Box>
      </Box>

      {/* ============================================== */}
      {/* HERO CONTENT (centered)                        */}
      {/* ============================================== */}
      <Box
        sx={{
          position: "relative",
          zIndex: 10,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          px: { xs: 3, sm: 6, md: 8 },
          py: 12,
        }}
      >
        <Fade in timeout={1200}>
          <Box sx={{ maxWidth: 900 }}>
            <Typography
              sx={{
                color: "#DAA520",
                fontWeight: 800,
                letterSpacing: { xs: 4, md: 8 },
                fontSize: { xs: "0.65rem", md: "0.85rem" },
                mb: 3,
              }}
            >
              ANBESA BANK S.C. — COMPLIANCE PORTAL
            </Typography>

            <Typography
              variant="h1"
              sx={{
                color: "#fff",
                fontWeight: 900,
                textTransform: "uppercase",
                lineHeight: 1.05,
                fontSize: { xs: "2rem", sm: "3rem", md: "4.5rem" },
                letterSpacing: { xs: -0.5, md: -1.5 },
                mb: 3,
                textShadow: "0 4px 24px rgba(0,0,0,0.6)",
              }}
            >
              {slide.title}
            </Typography>

            <Typography
              sx={{
                color: "rgba(255,255,255,0.85)",
                fontWeight: 400,
                lineHeight: 1.6,
                fontSize: { xs: "0.9rem", md: "1.15rem" },
                maxWidth: 720,
                mx: "auto",
                mb: 5,
                textShadow: "0 2px 12px rgba(0,0,0,0.5)",
              }}
            >
              {slide.desc}
            </Typography>
          </Box>
        </Fade>
      </Box>

      {/* ============================================== */}
      {/* BOTTOM FOOTER                                  */}
      {/* ============================================== */}
      <Box
        sx={{
          position: "absolute",
          bottom: { xs: 16, md: 24 },
          left: 0,
          right: 0,
          zIndex: 15,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 1,
          color: "rgba(255,255,255,0.6)",
          px: 2,
        }}
      >
        <ShieldIcon sx={{ fontSize: 14 }} />
        <Typography
          sx={{
            fontSize: { xs: "0.6rem", md: "0.7rem" },
            letterSpacing: 1.5,
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          RESTRICTED ACCESS — AUTHORIZED PERSONNEL ONLY
        </Typography>
      </Box>

      {/* ============================================== */}
      {/* LOGIN MODAL                                    */}
      {/* ============================================== */}
      <Modal
        open={modalOpen}
        onClose={handleCloseLogin}
        closeAfterTransition
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
        }}
      >
        <Fade in={modalOpen}>
          <Box
            sx={{
              position: "relative",
              width: "100%",
              maxWidth: 430,
              bgcolor: "#FFFFFF",
              borderRadius: 4,
              boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
              p: { xs: 3, sm: 4, md: 5 },
              outline: "none",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            {/* Close */}
            <IconButton
              onClick={handleCloseLogin}
              sx={{
                position: "absolute",
                right: 8,
                top: 8,
                color: "#666",
                zIndex: 1,
                "&:hover": { color: "#DAA520" },
              }}
            >
              <CloseIcon sx={{ fontSize: 24 }} />
            </IconButton>

            <Box sx={{ textAlign: "center", mt: 1 }}>
              <Avatar
                sx={{
                  width: 80,
                  height: 80,
                  margin: "0 auto 18px",
                  border: "4px solid #DAA520",
                  background: "#DAA520",
                  color: "#000000",
                  fontSize: "1.8rem",
                  fontWeight: "bold",
                }}
              >
                አ
              </Avatar>

              <Typography
                variant="h5"
                fontWeight={900}
                sx={{
                  color: "#000",
                  mb: 1,
                  letterSpacing: -0.5,
                  fontSize: { xs: "1.4rem", sm: "1.6rem" },
                }}
              >
                WELCOME BACK
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: "#BBB",
                  fontWeight: 700,
                  mb: 4,
                  display: "block",
                  letterSpacing: 1.5,
                  fontSize: "0.72rem",
                }}
              >
                SIGN IN TO YOUR ACCOUNT
              </Typography>

              <form onSubmit={handleLogin}>
                <TextField
                  fullWidth
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  margin="normal"
                  autoFocus
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon
                          sx={{ color: "#DAA520", fontSize: 24 }}
                        />
                      </InputAdornment>
                    ),
                  }}
                  sx={inputTheme}
                />

                <Box sx={{ position: "relative", mt: 1 }}>
                  <TextField
                    fullWidth
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    margin="normal"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <KeyIcon
                            sx={{ color: "#DAA520", fontSize: 24 }}
                          />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      ...inputTheme,
                      "& .MuiOutlinedInput-root": {
                        ...inputTheme["& .MuiOutlinedInput-root"],
                        paddingRight: "56px !important",
                      },
                    }}
                  />
                  <IconButton
                    onClick={togglePasswordVisibility}
                    onMouseDown={(e) => e.preventDefault()}
                    sx={{
                      position: "absolute",
                      right: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#DAA520",
                      zIndex: 1,
                    }}
                  >
                    {showPassword ? (
                      <VisibilityOffIcon sx={{ color: "#DAA520" }} />
                    ) : (
                      <VisibilityIcon sx={{ color: "#DAA520" }} />
                    )}
                  </IconButton>
                </Box>

                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "flex-end",
                    mt: 4,
                  }}
                >
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={loading || !username || !password}
                    sx={{
                      py: 1.2,
                      px: 4,
                      borderRadius: 0,
                      fontSize: "0.85rem",
                      fontWeight: "700",
                      color: "#000",
                      backgroundColor: "#DAA520",
                      minWidth: 120,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      "&:hover": { backgroundColor: "#B8860B" },
                      "&:disabled": {
                        backgroundColor: "#ccc",
                        color: "#666",
                      },
                    }}
                  >
                    {loading ? "..." : "Login"}
                  </Button>
                </Box>
              </form>
            </Box>
          </Box>
        </Fade>
      </Modal>
    </Box>
  );
};

const inputTheme = {
  "& .MuiOutlinedInput-root": {
    color: "#000",
    backgroundColor: "#FDFDFD",
    borderRadius: "50px",
    fontWeight: "bold",
    fontSize: "1rem",
    "& fieldset": { borderColor: "#EEE" },
    "&:hover fieldset": { borderColor: "#DAA520" },
    "&.Mui-focused fieldset": {
      borderColor: "#DAA520",
      borderWidth: "2px",
    },
  },
};

export default Landing;