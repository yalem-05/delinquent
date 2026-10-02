import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  useMediaQuery,
  useTheme,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Slide,
  Snackbar,
  TablePagination,
} from "@mui/material";
import {
  Close as CloseIcon,
  Refresh as RefreshIcon,
  CloudUpload as CloudUploadIcon,
  InsertDriveFile as FileIcon,
  Public as PublicIcon,
  Gavel as GavelIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  AssignmentLate as ListIcon,
  AccountBalance as BankIcon,
  Security as SecurityIcon,
} from "@mui/icons-material";
import axios from "axios";
import ListGrid from "./listgrid";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5080";

const LISTS_CONFIG = [
  { id: 'pep', title: 'International PEPs', getEndpoint: '/api/list/pep', uploadEndpoint: '/api/list/pep/upload', allowedExt: ['.csv', '.xlsx'], Icon: PublicIcon },
  { id: 'sanctions', title: 'UK-Sanctions-List', getEndpoint: '/api/list/sanctions/all', uploadEndpoint: '/api/list/sanctions/upload', allowedExt: ['.xml'], Icon: GavelIcon },
  { id: 'eusanctions', title: 'EU Sanctions', getEndpoint: '/api/list/eusanctions/all', uploadEndpoint: '/api/list/eusanctions/upload', allowedExt: ['.xml'], Icon: SecurityIcon },
  { id: 'ofacsanctions', title: 'OFAC Sanctions', getEndpoint: '/api/list/ofac', uploadEndpoint: '/api/list/ofac/upload', allowedExt: ['.xml'], Icon: GavelIcon },
  { id: 'unsanctions', title: 'UN Sanctions', getEndpoint: '/api/list/un', uploadEndpoint: '/api/list/un/upload', allowedExt: ['.xml'], Icon: PublicIcon },
  { id: 'undesignated', title: 'UN Designated', getEndpoint: '/api/list/undesignated', uploadEndpoint: '/api/list/undesignated/upload', allowedExt: ['.xml'], Icon: PublicIcon },
  { id: 'blacklist', title: 'Black List', getEndpoint: '/api/list/local/blacklist', uploadEndpoint: '/api/list/local/blacklist/upload', allowedExt: ['.csv', '.xlsx'], Icon: ListIcon },
  { id: 'deliquent', title: 'Delinquent List', getEndpoint: '/api/list/local/deliquent', uploadEndpoint: '/api/list/local/deliquent/upload', allowedExt: ['.csv', '.xlsx'], Icon: BankIcon },
  { id: 'eth', title: 'ETH List', getEndpoint: '/api/list/local/eth', uploadEndpoint: '/api/list/local/eth/upload', allowedExt: ['.csv', '.xlsx'], Icon: ListIcon },
  { id: 'localpep', title: 'Local PEP', getEndpoint: '/api/list/local/pep', uploadEndpoint: '/api/list/local/pep/upload', allowedExt: ['.csv', '.xlsx'], Icon: PublicIcon },
  { id: 'pepadverser', title: 'PEP Adverser', getEndpoint: '/api/list/local/pepadverser', uploadEndpoint: '/api/list/local/pepadverser/upload', allowedExt: ['.csv', '.xlsx'], Icon: GavelIcon },
];

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const scrollbarStyles = {
  "&::-webkit-scrollbar": { width: "8px", height: "8px" },
  "&::-webkit-scrollbar-track": {
    backgroundColor: "#f1f1f1",
    borderRadius: "4px",
  },
  "&::-webkit-scrollbar-thumb": {
    backgroundColor: "#DAA520",
    borderRadius: "4px",
    "&:hover": { backgroundColor: "#b8860b" },
  },
};

const List = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [listsData, setListsData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Upload dialog
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadTarget, setUploadTarget] = useState(null); // id of the config
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [uploading, setUploading] = useState(false);

  // Pagination states
  const [pages, setPages] = useState(LISTS_CONFIG.reduce((acc, curr) => ({ ...acc, [curr.id]: 0 }), {}));
  const [rowsPerPages, setRowsPerPages] = useState(LISTS_CONFIG.reduce((acc, curr) => ({ ...acc, [curr.id]: 10 }), {}));

  // Snackbar
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const showSnackbar = (message, severity = "success") => setSnackbar({ open: true, message, severity });
  const handleSnackbarClose = () => setSnackbar((s) => ({ ...s, open: false }));

  const currentTargetConfig = LISTS_CONFIG.find(c => c.id === uploadTarget);

  // =========================================================
  // Fetch lists
  // =========================================================
  const fetchLists = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const newListsData = {};
      const token = localStorage.getItem("token");

      const results = await Promise.allSettled(
        LISTS_CONFIG.map(config => axios.get(`${API_URL}${config.getEndpoint}`, {
          headers: { Authorization: `Bearer ${token}` }
        }))
      );

      results.forEach((res, index) => {
        const configId = LISTS_CONFIG[index].id;
        if (res.status === 'fulfilled') {
          let fetchedData = res.value.data?.data || res.value.data?.records || res.value.data || [];
          if (!Array.isArray(fetchedData)) {
            fetchedData = Object.values(fetchedData).find(Array.isArray) || [];
          }
          newListsData[configId] = fetchedData;
        } else {
          newListsData[configId] = [];
          console.error(`Failed to fetch ${configId}:`, res.reason);
        }
      });

      setListsData(newListsData);

      if (results.every(r => r.status === 'rejected')) {
        setError("Failed to fetch lists");
      }
    } catch (err) {
      console.error("Error fetching lists:", err);
      setError(err.response?.data?.message || "Error fetching lists");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  // =========================================================
  // Upload flow
  // =========================================================
  const openUploadDialog = (targetId) => {
    setUploadTarget(targetId);
    setSelectedFile(null);
    setFileError("");
    setUploadDialogOpen(true);
  };

  const closeUploadDialog = () => {
    setUploadDialogOpen(false);
    setUploadTarget(null);
    setSelectedFile(null);
    setFileError("");
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !currentTargetConfig) return;

    const lower = file.name.toLowerCase();
    const valid = currentTargetConfig.allowedExt.some((ext) => lower.endsWith(ext));

    if (!valid) {
      setSelectedFile(null);
      setFileError(`Invalid file type. Allowed: ${currentTargetConfig.allowedExt.join(", ")}`);
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
    setFileError("");
  };

  const handleUpload = async () => {
    if (!selectedFile || !currentTargetConfig) {
      setFileError("Please choose a valid file first");
      return;
    }

    try {
      setUploading(true);
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await axios.post(`${API_URL}${currentTargetConfig.uploadEndpoint}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`
        },
      });

      if (res.data?.success !== false) {
        showSnackbar(`${currentTargetConfig.title} uploaded successfully`, "success");
        closeUploadDialog();
        fetchLists();
      } else {
        showSnackbar(res.data?.message || "Upload failed", "error");
      }
    } catch (err) {
      console.error("Upload error:", err);
      showSnackbar(err.response?.data?.message || "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  };

  // =========================================================
  // Table renderers
  // =========================================================
  const headerCell = {
    fontWeight: "bold",
    minWidth: 120,
    whiteSpace: "nowrap",
    bgcolor: "#fff8e1",
  };

  const renderTableContent = (dataArray, configId) => {
    if (!dataArray || dataArray.length === 0) return null;

    const page = pages[configId];
    const rpp = rowsPerPages[configId];
    const paginatedData = dataArray.slice(page * rpp, page * rpp + rpp);

    // Generate dynamic headers based on the first object keys
    const columns = Object.keys(dataArray[0]);

    return (
      <TableContainer sx={{ maxHeight: 420, overflow: "auto", ...scrollbarStyles }}>
        <Table stickyHeader size="medium">
          <TableHead>
            <TableRow>
              <TableCell sx={headerCell}>#</TableCell>
              {columns.map(col => (
                <TableCell key={col} sx={{ ...headerCell, textTransform: 'capitalize' }}>
                  {col.replace(/_/g, " ")}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedData.map((row, index) => {
              const actualIndex = page * rpp + index;
              return (
                <TableRow
                  key={actualIndex}
                  sx={{
                    "&:hover": { bgcolor: "#fafafa" },
                    "&:nth-of-type(odd)": { bgcolor: "#fafafa" },
                  }}
                >
                  <TableCell>{actualIndex + 1}</TableCell>
                  {columns.map(col => (
                    <TableCell key={col} sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {typeof row[col] === 'object' && row[col] !== null
                        ? JSON.stringify(row[col])
                        : String(row[col] ?? "—")}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  const renderPanel = (config) => {
    const dataArray = listsData[config.id] || [];
    const IconComponent = config.Icon;

    return (
      <Paper key={config.id} sx={{ mb: 4, borderRadius: 2, overflow: "hidden" }}>
        <Box
          sx={{
            p: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            borderBottom: "1px solid #e0e0e0",
            bgcolor: "#fafafa",
            flexWrap: "wrap",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <IconComponent sx={{ color: "#DAA520" }} />
            <Typography variant="h6" fontWeight="bold">
              {config.title}
            </Typography>
            <Chip label={dataArray.length} size="small" color="warning" sx={{ ml: 1 }} />
          </Box>
          <Button
            variant="contained"
            startIcon={<CloudUploadIcon />}
            onClick={() => openUploadDialog(config.id)}
            sx={{ bgcolor: "#DAA520", color: "#000", "&:hover": { bgcolor: "#b8860b" } }}
          >
            Add {config.title}
          </Button>
        </Box>

        {dataArray.length === 0 ? (
          <Box sx={{ p: 6, textAlign: "center" }}>
            <IconComponent sx={{ fontSize: 48, color: "#ccc", mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              No {config.title} records yet. Click <b>Add {config.title}</b> to upload a{" "}
              <b>{config.allowedExt.join(" or ")}</b> file.
            </Typography>
          </Box>
        ) : (
          <>
            {renderTableContent(dataArray, config.id)}
            <TablePagination
              rowsPerPageOptions={[5, 10, 25, 50]}
              component="div"
              count={dataArray.length}
              rowsPerPage={rowsPerPages[config.id]}
              page={pages[config.id]}
              onPageChange={(e, np) => setPages(p => ({ ...p, [config.id]: np }))}
              onRowsPerPageChange={(e) => {
                setRowsPerPages(p => ({ ...p, [config.id]: parseInt(e.target.value, 10) }));
                setPages(p => ({ ...p, [config.id]: 0 }));
              }}
              sx={{
                borderTop: "1px solid #e0e0e0",
                "& .MuiTablePagination-select": { color: "#DAA520" },
                "& .MuiTablePagination-actions .MuiIconButton-root": {
                  color: "#DAA520",
                  "&:hover": { backgroundColor: "rgba(218, 165, 32, 0.1)" },
                },
              }}
            />
          </>
        )}
      </Paper>
    );
  };

  // =========================================================
  // Render
  // =========================================================
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f5f5f5", py: isMobile ? 1 : 2 }}>
      <ListGrid />
    </Box>
  );
};

export default List;