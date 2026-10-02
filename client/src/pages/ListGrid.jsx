import React, { useState, useEffect } from "react";
import {
    Box,
    Container,
    Typography,
    Grid,
    Card,
    CardContent,
    CardActionArea,
    Chip,
    CircularProgress,
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
    alpha,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
} from "@mui/material";
import {
    Close as CloseIcon,
    CloudUpload as CloudUploadIcon,
    CheckCircle as CheckCircleIcon,
    Delete as DeleteIcon,
    Public as PublicIcon,
    Gavel as GavelIcon,
    AssignmentLate as ListIcon,
    AccountBalance as BankIcon,
    Security as SecurityIcon,
    Visibility as VisibilityIcon,
    Edit as EditIcon,
    Warning as WarningIcon
} from "@mui/icons-material";
import DownloadIcon from "@mui/icons-material/Download";
import { TextField } from "@mui/material";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;
const API_COUNT = `${import.meta.env.VITE_API_URL}/api/adminDashboard/stats`;

// Static config — no `value` here. The count is looked up from `data` at render time.
const CARDS_CONFIG = [
    { id: "pep", countKey: "international_pep", title: "International PEP", badge: ".CSV / .XLSX", endpoint: "/api/list/pep/upload", getEndpoint: "/api/list/pep", allowedExt: [".csv", ".xlsx"], icon: <PublicIcon fontSize="large" />, color: "#2196f3" },
    { id: "sanctions", countKey: "uk_sanctions", title: "UK Sanctions", badge: ".XML", endpoint: "/api/list/sanctions/upload", getEndpoint: "/api/list/sanctions/all", allowedExt: [".xml"], icon: <SecurityIcon fontSize="large" />, color: "#f44336" },
    { id: "eusanctions", countKey: "eu_sanctions", title: "EU Sanctions", badge: ".XML", endpoint: "/api/list/eusanctions/upload", getEndpoint: "/api/list/eusanctions/all", allowedExt: [".xml"], icon: <SecurityIcon fontSize="large" />, color: "#1976d2" },
    { id: "ofacsanctions", countKey: "ofac_sanctions", title: "OFAC Sanctions", badge: ".XML", endpoint: "/api/list/ofac/upload", getEndpoint: "/api/list/ofac", allowedExt: [".xml"], icon: <GavelIcon fontSize="large" />, color: "#d32f2f" },
    { id: "unsanctions", countKey: "un_sanctions", title: "UN Sanctions", badge: ".XML", endpoint: "/api/list/un/upload", getEndpoint: "/api/list/un", allowedExt: [".xml"], icon: <PublicIcon fontSize="large" />, color: "#0288d1" },
    { id: "undesignated", countKey: "un_designated", title: "UN Designated", badge: ".XML", endpoint: "/api/list/undesignated/upload", getEndpoint: "/api/list/undesignated", allowedExt: [".xml"], icon: <PublicIcon fontSize="large" />, color: "#03a9f4" },
    { id: "blacklist", countKey: "black_list", title: "Black List", badge: ".CSV / .XLSX", endpoint: "/api/list/local/blacklist/upload", getEndpoint: "/api/list/local/blacklist", allowedExt: [".csv", ".xlsx"], icon: <ListIcon fontSize="large" />, color: "#212121" },
    { id: "deliquent", countKey: "deliquent_list", title: "Delinquent List", badge: ".CSV / .XLSX", endpoint: "/api/list/local/deliquent/upload", getEndpoint: "/api/list/local/deliquent", allowedExt: [".csv", ".xlsx"], icon: <BankIcon fontSize="large" />, color: "#ff9800" },
    { id: "eth", countKey: "eth_list", title: "ETH List", badge: ".CSV / .XLSX", endpoint: "/api/list/local/eth/upload", getEndpoint: "/api/list/local/eth", allowedExt: [".csv", ".xlsx"], icon: <ListIcon fontSize="large" />, color: "#4caf50" },
    { id: "localpep", countKey: "local_peps", title: "Local PEP", badge: ".CSV / .XLSX", endpoint: "/api/list/local/pep/upload", getEndpoint: "/api/list/local/pep", allowedExt: [".csv", ".xlsx"], icon: <PublicIcon fontSize="large" />, color: "#ffb300" },
    { id: "pepadverser", countKey: "pep_adverser", title: "PEP Adverser", badge: ".CSV / .XLSX", endpoint: "/api/list/local/pepadverser/upload", getEndpoint: "/api/list/local/pepadverser", allowedExt: [".csv", ".xlsx"], icon: <GavelIcon fontSize="large" />, color: "#e53935" },
];

const Transition = React.forwardRef(function Transition(props, ref) {
    return <Slide direction="up" ref={ref} {...props} />;
});

const ListGrid = () => {
    const theme = useTheme();

    // Dashboard stats
    const [data, setData] = useState({});
    const [loading, setLoading] = useState(false);

    // Upload dialog
    const [selectedConfig, setSelectedConfig] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [fileError, setFileError] = useState("");
    const [uploading, setUploading] = useState(false);
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

    // Snackbar
    const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

    // Data viewing dialog
    const [dataDialogOpen, setDataDialogOpen] = useState(false);
    const [viewingConfig, setViewingConfig] = useState(null);
    const [listData, setListData] = useState([]);
    const [dataLoading, setDataLoading] = useState(false);

    // Pagination & Search state
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(20);
    const [searchQuery, setSearchQuery] = useState("");
    const [totalCount, setTotalCount] = useState(0);

    // Edit & Delete state
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editingRow, setEditingRow] = useState(null);
    const [editFormData, setEditFormData] = useState({});
    const [actionLoading, setActionLoading] = useState(false);

    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deletingRow, setDeletingRow] = useState(null);

    const fetchDashboardDataCount = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem("token");
            const response = await axios.get(API_COUNT, {
                headers: { Authorization: `Bearer ${token}` },
            });
            console.log("Dashboard data:", response.data);
            setData(response.data?.data || {});
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };
    // ---- Fetch dashboard counts ----
    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                setLoading(true);
                const token = localStorage.getItem("token");
                const response = await axios.get(API_COUNT, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                console.log("Dashboard data:", response.data);
                setData(response.data?.data || {});
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchDashboardData();
    }, []);

    const showSnackbar = (message, severity = "success") =>
        setSnackbar({ open: true, message, severity });
    const handleSnackbarClose = () => setSnackbar((s) => ({ ...s, open: false }));

    // ---- View data ----
    const fetchData = async (config, pageNum, limit, search = "") => {
        setDataLoading(true);
        try {
            const offset = pageNum * limit;
            console.log(`[DEBUG] Fetching pageNum=${pageNum}, limit=${limit}, offset=${offset}, search=${search}`);
            const searchParam = search ? `&search=${encodeURIComponent(search)}` : "";
            const url = `${API_URL}${config.getEndpoint}?page=${pageNum + 1}&limit=${limit}&offset=${offset}${searchParam}`;
            console.log(`[DEBUG] URL: ${url}`);
            
            const token = localStorage.getItem("token");
            const res = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log(`[DEBUG] Received ${res.data?.data?.length || 0} rows from backend.`);
            let fetchedData = res.data?.data || res.data?.records || res.data || [];
            if (!Array.isArray(fetchedData)) {
                fetchedData = Object.values(fetchedData).find(Array.isArray) || [];
            }
            setListData(fetchedData);
            setTotalCount(res.data?.count !== undefined ? res.data.count : (data?.[config.countKey] || fetchedData.length));
        } catch (err) {
            console.error("Fetch data error:", err);
            showSnackbar("Failed to fetch data.", "error");
        } finally {
            setDataLoading(false);
        }
    };

    const openDataDialog = (config) => {
        setViewingConfig(config);
        setDataDialogOpen(true);
        setListData([]);
        setPage(0);
        setSearchQuery("");
        fetchData(config, 0, rowsPerPage, "");
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
        fetchData(viewingConfig, newPage, rowsPerPage, searchQuery);
    };

    const handleChangeRowsPerPage = (event) => {
        const newLimit = parseInt(event.target.value, 10);
        setRowsPerPage(newLimit);
        setPage(0);
        fetchData(viewingConfig, 0, newLimit, searchQuery);
    };

    const closeDataDialog = () => {
        setDataDialogOpen(false);
        setTimeout(() => {
            setViewingConfig(null);
            setListData([]);
        }, 200);
    };

    // ---- Edit and Delete Handlers ----
    const getRowId = (row) => row.id || row.no || row.sn;

    const handleEditClick = (row) => {
        setEditingRow(row);
        setEditFormData({ ...row });
        setEditDialogOpen(true);
    };

    const handleDeleteClick = (row) => {
        setDeletingRow(row);
        setDeleteConfirmOpen(true);
    };

    const handleEditSave = async () => {
        const rowId = getRowId(editingRow);
        if (!rowId) {
            showSnackbar("Cannot identify record ID", "error");
            return;
        }
        setActionLoading(true);
        try {
            const token = localStorage.getItem("token");
            await axios.put(`${API_URL}${viewingConfig.getEndpoint}/${rowId}`, editFormData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showSnackbar("Record updated successfully", "success");
            setEditDialogOpen(false);
            fetchData(viewingConfig, page, rowsPerPage, searchQuery);
        } catch (err) {
            console.error("Update error:", err);
            showSnackbar("Failed to update record", "error");
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteConfirm = async () => {
        const rowId = getRowId(deletingRow);
        if (!rowId) {
            showSnackbar("Cannot identify record ID", "error");
            return;
        }
        setActionLoading(true);
        try {
            const token = localStorage.getItem("token");
            await axios.delete(`${API_URL}${viewingConfig.getEndpoint}/${rowId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showSnackbar("Record deleted successfully", "success");
            setDeleteConfirmOpen(false);
            fetchDashboardDataCount();
            fetchData(viewingConfig, page, rowsPerPage, searchQuery);
        } catch (err) {
            console.error("Delete error:", err);
            showSnackbar("Failed to delete record", "error");
        } finally {
            setActionLoading(false);
        }
    };

    // ---- Upload ----
    const openUploadDialog = (config) => {
        setSelectedConfig(config);
        setSelectedFile(null);
        setFileError("");
        setUploadDialogOpen(true);
    };

    const closeUploadDialog = () => {
        setUploadDialogOpen(false);
        setTimeout(() => {
            setSelectedConfig(null);
            setSelectedFile(null);
            setFileError("");
        }, 200);
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const lower = file.name.toLowerCase();
        const valid = selectedConfig.allowedExt.some((ext) => lower.endsWith(ext));

        if (!valid) {
            setSelectedFile(null);
            setFileError(`Invalid file type. Allowed: ${selectedConfig.allowedExt.join(", ")}`);
            e.target.value = "";
            return;
        }

        setSelectedFile(file);
        setFileError("");
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            setFileError("Please choose a file first");
            return;
        }
        if (!selectedConfig) return;

        try {
            setUploading(true);
            const formData = new FormData();
            formData.append("file", selectedFile);

            const endpoint = `${API_URL}${selectedConfig.endpoint}`;
            const token = localStorage.getItem("token");
            const res = await axios.post(endpoint, formData, {
                headers: { 
                    "Content-Type": "multipart/form-data",
                    Authorization: `Bearer ${token}`
                },
            });

            if (res.data?.success !== false) {
                showSnackbar(`${selectedConfig.title} uploaded successfully`, "success");
                fetchDashboardDataCount()
                closeUploadDialog();
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

    return (
        <Box sx={{ minHeight: "100vh", bgcolor: "#f5f7fa", pt: 4, pb: 10 }}>
            <Container maxWidth="lg">
                {/* Header */}
                <Box sx={{ mb: 6, textAlign: "center" }}>
                    <Typography
                        variant="h6"
                        color="text.secondary"
                        sx={{ maxWidth: "800px", mx: "auto", mb: 4 }}
                    >
                        Securely upload and synchronize the records across the system.
                    </Typography>
                </Box>

                {/* Grid of Cards */}
                <Grid container spacing={2}>
                    {CARDS_CONFIG.map((config) => {
                        const count = loading ? "…" : (data?.[config.countKey] ?? 0);

                        return (
                            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={config.id}>
                                <Card
                                    elevation={0}
                                    sx={{
                                        borderRadius: 3,
                                        border: "1px solid",
                                        borderColor: alpha(config.color, 0.2),
                                        overflow: "hidden",
                                        height: "100%",
                                        display: "flex",
                                        flexDirection: "column",
                                        transition: "all 0.25s ease",
                                        "&:hover": {
                                            transform: "translateY(-4px)",
                                            boxShadow: `0 12px 24px -10px ${alpha(config.color, 0.5)}`,
                                            borderColor: config.color,
                                        },
                                    }}
                                >
                                    <CardActionArea
                                        onClick={() => openUploadDialog(config)}
                                        sx={{ flexGrow: 1 }}
                                    >
                                        <CardContent sx={{ p: 2.5 }}>
                                            {/* Top row: icon tile + count */}
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "space-between",
                                                    mb: 2,
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        width: 48,
                                                        height: 48,
                                                        borderRadius: 2,
                                                        bgcolor: alpha(config.color, 0.12),
                                                        color: config.color,
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                    }}
                                                >
                                                    {config.icon}
                                                </Box>

                                                <Box sx={{ textAlign: "right" }}>
                                                    <Typography
                                                        variant="h5"
                                                        sx={{
                                                            fontWeight: 800,
                                                            color: config.color,
                                                            lineHeight: 1,
                                                            fontVariantNumeric: "tabular-nums",
                                                        }}
                                                    >
                                                        {typeof count === "number"
                                                            ? count.toLocaleString()
                                                            : count}
                                                    </Typography>
                                                    <Typography
                                                        variant="caption"
                                                        sx={{
                                                            color: "text.secondary",
                                                            fontWeight: 600,
                                                            letterSpacing: 0.5,
                                                            textTransform: "uppercase",
                                                            fontSize: "0.65rem",
                                                        }}
                                                    >
                                                        Records
                                                    </Typography>
                                                </Box>
                                            </Box>

                                            {/* Title */}
                                            <Typography
                                                variant="subtitle1"
                                                sx={{
                                                    fontWeight: 700,
                                                    color: "#2c3e50",
                                                    mb: 1,
                                                    lineHeight: 1.3,
                                                }}
                                            >
                                                {config.title}
                                            </Typography>
                                            <CloudUploadIcon />
                                            {/* Format chip */}
                                            <Chip
                                                label={config.badge.trim()}
                                                size="small"
                                                sx={{
                                                    fontWeight: 600,
                                                    fontSize: "0.7rem",
                                                    height: 22,
                                                    bgcolor: alpha(config.color, 0.1),
                                                    color: config.color,
                                                }}
                                            />
                                        </CardContent>
                                    </CardActionArea>

                                    {/* Footer outside CardActionArea to avoid nested buttons */}
                                    <Box
                                        sx={{
                                            borderTop: "1px solid",
                                            borderColor: alpha(config.color, 0.15),
                                            px: 1,
                                            py: 0.5,
                                            display: "flex",
                                            justifyContent: "center",
                                            alignItems: "center",
                                        }}
                                    >
                                        <Button
                                            size="small"
                                            startIcon={<VisibilityIcon fontSize="small" />}
                                            sx={{
                                                color: config.color,
                                                fontWeight: 600,
                                                textTransform: "none",
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openDataDialog(config);
                                            }}
                                        >

                                            {config.badge === ".XML" ? "View Data" : "View And Edit Data"}
                                        </Button>
                                    </Box>
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>

                {/* ---------- Upload Dialog ---------- */}
                <Dialog
                    open={uploadDialogOpen}
                    slots={{ transition: Transition }}
                    keepMounted
                    onClose={!uploading ? closeUploadDialog : undefined}
                    maxWidth="sm"
                    fullWidth
                    slotProps={{ paper: { sx: { borderRadius: 3, p: 1 } } }}
                >
                    {selectedConfig && (
                        <>
                            <DialogTitle>
                                <Box
                                    sx={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                    }}
                                >
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                        <Box sx={{ color: selectedConfig.color, display: "flex" }}>
                                            {selectedConfig.icon}
                                        </Box>
                                        <Typography
                                            variant="h6"
                                            sx={{ fontWeight: 700, color: "#2c3e50" }}
                                        >
                                            Upload {selectedConfig.title}
                                        </Typography>
                                    </Box>
                                    {!uploading && (
                                        <IconButton
                                            onClick={closeUploadDialog}
                                            size="small"
                                            sx={{ color: "text.secondary" }}
                                        >
                                            <CloseIcon />
                                        </IconButton>
                                    )}
                                </Box>
                            </DialogTitle>

                            <DialogContent>
                                <Box sx={{ mt: 2 }}>
                                    <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
                                        Please upload a valid{" "}
                                        <strong>{selectedConfig.badge.trim()}</strong> file to
                                        securely update the database.
                                    </Alert>

                                    <Box
                                        sx={{
                                            border: "2px dashed",
                                            borderColor: selectedFile
                                                ? "success.main"
                                                : alpha(selectedConfig.color, 0.5),
                                            borderRadius: 3,
                                            p: 4,
                                            textAlign: "center",
                                            bgcolor: selectedFile
                                                ? alpha(theme.palette.success.main, 0.05)
                                                : alpha(selectedConfig.color, 0.05),
                                            transition: "all 0.2s",
                                        }}
                                    >
                                        {!selectedFile ? (
                                            <>
                                                <CloudUploadIcon
                                                    sx={{
                                                        fontSize: 48,
                                                        color: selectedConfig.color,
                                                        mb: 1,
                                                    }}
                                                />
                                                <Typography
                                                    variant="subtitle1"
                                                    sx={{
                                                        fontWeight: 600,
                                                        color: "#2c3e50",
                                                        mb: 2,
                                                    }}
                                                >
                                                    Select or drag your file here
                                                </Typography>
                                                <input
                                                    type="file"
                                                    id="file-upload"
                                                    hidden
                                                    accept={selectedConfig.allowedExt.join(",")}
                                                    onChange={handleFileChange}
                                                />
                                                <label htmlFor="file-upload">
                                                    <Button
                                                        variant="outlined"
                                                        component="span"
                                                        sx={{
                                                            borderWidth: 2,
                                                            borderColor: selectedConfig.color,
                                                            color: selectedConfig.color,
                                                            "&:hover": {
                                                                borderWidth: 2,
                                                                borderColor: selectedConfig.color,
                                                                bgcolor: alpha(
                                                                    selectedConfig.color,
                                                                    0.1
                                                                ),
                                                            },
                                                        }}
                                                    >
                                                        Browse File
                                                    </Button>
                                                </label>
                                            </>
                                        ) : (
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    alignItems: "center",
                                                    gap: 1,
                                                }}
                                            >
                                                <CheckCircleIcon
                                                    sx={{
                                                        color: "success.main",
                                                        fontSize: 48,
                                                        mb: 1,
                                                    }}
                                                />
                                                <Typography
                                                    variant="body1"
                                                    sx={{ fontWeight: 600, color: "#2c3e50" }}
                                                >
                                                    {selectedFile.name}
                                                </Typography>
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                    sx={{ mb: 2 }}
                                                >
                                                    {(selectedFile.size / 1024).toFixed(1)} KB
                                                </Typography>
                                                <Button
                                                    variant="text"
                                                    color="error"
                                                    size="small"
                                                    startIcon={<DeleteIcon />}
                                                    onClick={() => setSelectedFile(null)}
                                                    disabled={uploading}
                                                >
                                                    Remove
                                                </Button>
                                            </Box>
                                        )}
                                    </Box>

                                    {fileError && (
                                        <Slide direction="up" in={!!fileError}>
                                            <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
                                                {fileError}
                                            </Alert>
                                        </Slide>
                                    )}
                                </Box>
                            </DialogContent>

                            <DialogActions sx={{ p: 3, pt: 1, gap: 1 }}>
                                <Button
                                    onClick={closeUploadDialog}
                                    variant="text"
                                    disabled={uploading}
                                    sx={{ color: "text.secondary" }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleUpload}
                                    variant="contained"
                                    disabled={uploading || !selectedFile}
                                    startIcon={
                                        uploading ? (
                                            <CircularProgress size={18} color="inherit" />
                                        ) : (
                                            <CloudUploadIcon />
                                        )
                                    }
                                    sx={{
                                        bgcolor: selectedConfig.color,
                                        color: "#fff",
                                        fontWeight: 600,
                                        px: 3,
                                        "&:hover": {
                                            bgcolor: selectedConfig.color,
                                            filter: "brightness(0.9)",
                                        },
                                    }}
                                >
                                    {uploading ? "Uploading..." : "Upload & Update"}
                                </Button>
                            </DialogActions>
                        </>
                    )}
                </Dialog>

                {/* ---------- Data View Dialog ---------- */}
                <Dialog
                    open={dataDialogOpen}
                    slots={{ transition: Transition }}
                    keepMounted
                    onClose={closeDataDialog}
                    maxWidth="lg"
                    fullWidth
                    slotProps={{
                        paper: { sx: { borderRadius: 3, p: 1, height: "80vh" } },
                    }}
                >
                    {viewingConfig && (
                        <>
                            <DialogTitle>
                                <Box
                                    sx={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                    }}
                                >
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                        <Box sx={{ color: viewingConfig.color, display: "flex" }}>
                                            {viewingConfig.icon}
                                        </Box>
                                        <Typography
                                            variant="h6"
                                            sx={{ fontWeight: 700, color: "#2c3e50" }}
                                        >
                                            {viewingConfig.title} Data
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                                        <Button
                                            variant="contained"
                                            startIcon={<CloudUploadIcon />}
                                            onClick={() => {
                                                closeDataDialog();
                                                openUploadDialog(viewingConfig);
                                            }}
                                            size="small"
                                            sx={{
                                                bgcolor: viewingConfig.color,
                                                color: "#fff",
                                                textTransform: "none",
                                                "&:hover": {
                                                    bgcolor: alpha(viewingConfig.color, 0.8),
                                                },
                                                boxShadow: 0,
                                                borderRadius: 2,
                                            }}
                                        >
                                            Import Data
                                        </Button>
                                        <IconButton
                                            onClick={closeDataDialog}
                                            size="small"
                                            sx={{
                                                color: "text.secondary",
                                                bgcolor: alpha("#000", 0.05),
                                            }}
                                        >
                                            <CloseIcon />
                                        </IconButton>
                                    </Box>
                                </Box>
                                {!viewingConfig.allowedExt.includes(".xml") && (
                                    <Box sx={{ mt: 2, display: "flex", gap: 1 }}>
                                        <TextField
                                            size="small"
                                            fullWidth
                                            placeholder="Search by name..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    setPage(0);
                                                    fetchData(viewingConfig, 0, rowsPerPage, searchQuery);
                                                }
                                            }}
                                            sx={{
                                                bgcolor: "#f9f9f9",
                                                borderRadius: 2,
                                                "& .MuiOutlinedInput-root": { borderRadius: 2 }
                                            }}
                                        />
                                        <Button
                                            variant="contained"
                                            onClick={() => {
                                                setPage(0);
                                                fetchData(viewingConfig, 0, rowsPerPage, searchQuery);
                                            }}
                                            sx={{
                                                bgcolor: viewingConfig.color,
                                                color: "#fff",
                                                boxShadow: 0,
                                                borderRadius: 2,
                                                "&:hover": {
                                                    bgcolor: alpha(viewingConfig.color, 0.8),
                                                }
                                            }}
                                        >
                                            Search
                                        </Button>
                                    </Box>
                                )}
                            </DialogTitle>

                            <DialogContent dividers sx={{ p: 0 }}>
                                {dataLoading ? (
                                    <Box
                                        sx={{
                                            display: "flex",
                                            justifyContent: "center",
                                            alignItems: "center",
                                            height: "100%",
                                            p: 4,
                                        }}
                                    >
                                        <CircularProgress sx={{ color: viewingConfig.color }} />
                                    </Box>
                                ) : listData.length === 0 ? (
                                    <Box
                                        sx={{
                                            display: "flex",
                                            justifyContent: "center",
                                            alignItems: "center",
                                            height: "100%",
                                            p: 4,
                                        }}
                                    >
                                        <Typography color="text.secondary">
                                            No data available or table is empty.
                                        </Typography>
                                    </Box>
                                ) : (
                                    <TableContainer sx={{ maxHeight: "100%" }}>
                                        <Table stickyHeader size="small">
                                            <TableHead>
                                                <TableRow>
                                                    {Object.keys(listData[0]).map((key) => (
                                                        <TableCell
                                                            key={key}
                                                            sx={{
                                                                background: `linear-gradient(${alpha(viewingConfig.color, 0.1)}, ${alpha(viewingConfig.color, 0.1)}), #fff`,
                                                                color: viewingConfig.color,
                                                                fontWeight: 700,
                                                                textTransform: "uppercase",
                                                                fontSize: "0.75rem",
                                                                whiteSpace: "nowrap",
                                                                zIndex: 10,
                                                            }}
                                                        >
                                                            {key.replace(/_/g, " ")}
                                                        </TableCell>
                                                    ))}
                                                    {!viewingConfig.allowedExt.includes(".xml") && (
                                                        <TableCell
                                                            align="right"
                                                            sx={{
                                                                background: `linear-gradient(${alpha(viewingConfig.color, 0.1)}, ${alpha(viewingConfig.color, 0.1)}), #fff`,
                                                                color: viewingConfig.color,
                                                                fontWeight: 700,
                                                                textTransform: "uppercase",
                                                                fontSize: "0.75rem",
                                                                whiteSpace: "nowrap",
                                                                zIndex: 11,
                                                                position: "sticky",
                                                                right: 0,
                                                                boxShadow: "-2px 0 5px rgba(0,0,0,0.05)",
                                                            }}
                                                        >
                                                            Actions
                                                        </TableCell>
                                                    )}
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {listData.slice(0, rowsPerPage).map((row, i) => (
                                                    <TableRow key={i} hover>
                                                        {Object.values(row).map((val, j) => (
                                                            <TableCell
                                                                key={j}
                                                                sx={{
                                                                    fontSize: "0.8rem",
                                                                    maxWidth: 200,
                                                                    overflow: "hidden",
                                                                    textOverflow: "ellipsis",
                                                                    whiteSpace: "nowrap",
                                                                }}
                                                            >
                                                                {typeof val === "object" &&
                                                                    val !== null
                                                                    ? JSON.stringify(val)
                                                                    : String(val ?? "")}
                                                            </TableCell>
                                                        ))}
                                                        {!viewingConfig.allowedExt.includes(".xml") && (
                                                            <TableCell
                                                                align="right"
                                                                sx={{
                                                                    position: "sticky",
                                                                    right: 0,
                                                                    bgcolor: "background.paper",
                                                                    p: 0.5,
                                                                    boxShadow: "-2px 0 5px rgba(0,0,0,0.05)",
                                                                }}
                                                            >
                                                                <IconButton size="small" color="primary" onClick={() => handleEditClick(row)} sx={{ mr: 0.5 }}>
                                                                    <EditIcon fontSize="small" />
                                                                </IconButton>
                                                                <IconButton size="small" color="error" onClick={() => handleDeleteClick(row)}>
                                                                    <DeleteIcon fontSize="small" />
                                                                </IconButton>
                                                            </TableCell>
                                                        )}
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                )}
                                {listData.length > 0 && !dataLoading && (
                                    <TablePagination
                                        component="div"
                                        count={totalCount}
                                        page={page}
                                        onPageChange={handleChangePage}
                                        rowsPerPage={rowsPerPage}
                                        onRowsPerPageChange={handleChangeRowsPerPage}
                                        rowsPerPageOptions={[20, 50, 100]}
                                    />
                                )}
                            </DialogContent>
                        </>
                    )}
                </Dialog>

                {/* Snackbar */}
                <Snackbar
                    open={snackbar.open}
                    autoHideDuration={5000}
                    onClose={handleSnackbarClose}
                    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                >
                    <Alert
                        onClose={handleSnackbarClose}
                        severity={snackbar.severity}
                        sx={{ width: "100%", borderRadius: 2, boxShadow: 3 }}
                    >
                        {snackbar.message}
                    </Alert>
                </Snackbar>

                {/* Edit Dialog */}
                <Dialog open={editDialogOpen} onClose={() => !actionLoading && setEditDialogOpen(false)} maxWidth="sm" fullWidth>
                    <DialogTitle sx={{ fontWeight: 700, color: "#2c3e50" }}>Edit Record</DialogTitle>
                    <DialogContent dividers>
                        <Grid container spacing={2} sx={{ pt: 1 }}>
                            {editingRow && Object.keys(editingRow).map((key) => {
                                const isPk = key === "id" || key === "no" || key === "sn";
                                return (
                                    <Grid size={{ xs: 12, sm: 6 }} key={key}>
                                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                                {key.replace(/_/g, " ").toUpperCase()}
                                            </Typography>
                                            <TextField
                                                size="small"
                                                variant="outlined"
                                                disabled={isPk}
                                                value={editFormData[key] || ""}
                                                onChange={(e) => setEditFormData({ ...editFormData, [key]: e.target.value })}
                                                fullWidth
                                                sx={{
                                                    "& .MuiOutlinedInput-root": {
                                                        borderRadius: 2,
                                                        bgcolor: isPk ? "#f5f5f5" : "#fff",
                                                    }
                                                }}
                                            />
                                        </Box>
                                    </Grid>
                                );
                            })}
                        </Grid>
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={() => setEditDialogOpen(false)} disabled={actionLoading} sx={{ color: "text.secondary" }}>
                            Cancel
                        </Button>
                        <Button onClick={handleEditSave} variant="contained" disabled={actionLoading} startIcon={actionLoading && <CircularProgress size={16} color="inherit" />} sx={{ borderRadius: 2 }}>
                            {actionLoading ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Delete Confirm Dialog */}
                <Dialog open={deleteConfirmOpen} onClose={() => !actionLoading && setDeleteConfirmOpen(false)} maxWidth="xs" fullWidth>
                    <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main', fontWeight: 700 }}>
                        <WarningIcon /> Confirm Deletion
                    </DialogTitle>
                    <DialogContent>
                        <Typography sx={{ color: "#2c3e50" }}>
                            Are you sure you want to delete this record? This action cannot be undone.
                        </Typography>
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={() => setDeleteConfirmOpen(false)} disabled={actionLoading} sx={{ color: "text.secondary" }}>
                            Cancel
                        </Button>
                        <Button onClick={handleDeleteConfirm} variant="contained" color="error" disabled={actionLoading} startIcon={actionLoading && <CircularProgress size={16} color="inherit" />} sx={{ borderRadius: 2 }}>
                            {actionLoading ? "Deleting..." : "Delete Record"}
                        </Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </Box>
    );
};

export default ListGrid;