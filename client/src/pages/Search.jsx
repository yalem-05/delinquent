import React, { useState } from 'react';
import {
    Box,
    TextField,
    Button,
    Typography,
    Card,
    CardContent,
    CircularProgress,
    IconButton,
    Chip,
    Grid,
    InputAdornment,
    Collapse,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    alpha,
    Container,
    Paper,
    useTheme,
    useMediaQuery,
    Snackbar,
    Alert
} from "@mui/material";
import {
    Search as SearchIcon,
    Clear as ClearIcon,
    ExpandMore as ExpandMoreIcon,
    Public as PublicIcon,
    Gavel as GavelIcon,
    AssignmentLate as ListIcon,
    Security as SecurityIcon,
    AccountBalance as BankIcon,
} from "@mui/icons-material";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5080";

const ICONS_MAP = {
    International_PEPs: <PublicIcon />,
    UK_Sanctions_List: <GavelIcon />,
    EU_Sanctions_List: <SecurityIcon />,
    OFAC_Sanctions_List: <GavelIcon />,
    UN_Sanctions_List: <PublicIcon />,
    UN_Designated_List: <PublicIcon />,
    Black_List: <ListIcon />,
    Deliquent_List: <BankIcon />,
    ETH_List: <ListIcon />,
    Local_PEPs: <PublicIcon />,
    PEP_Adverser_List: <GavelIcon />
};

const Search = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
    const [query, setQuery] = useState('');
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    const showSnackbar = (message, severity = 'success') => {
        setSnackbar({ open: true, message, severity });
    };

    const handleSnackbarClose = () => {
        setSnackbar(prev => ({ ...prev, open: false }));
    };

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        if (!query.trim()) {
            setResults(null);
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const response = await axios.get(`${API_URL}/api/search/all?name=${encodeURIComponent(query)}`, {
            });
            const data = response.data;

            if (data.success) {
                setResults(data);
                showSnackbar('Search completed successfully', 'success');
            } else {
                setResults(null);
                showSnackbar(data.error || 'Search failed', 'error');
            }
        } catch (error) {
            console.error(error);
            setResults(null);
            showSnackbar('Network error during search', 'error');
        } finally {
            setLoading(false);
        }
    };

    const clearSearch = () => {
        setQuery('');
        setResults(null);
    };

    // Helper to safely parse JSON strings (for name_aliases, names, etc.)
    const safeParse = (str) => {
        if (!str) return [];
        try {
            const parsed = typeof str === 'string' ? JSON.parse(str) : str;
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
            return [str];
        }
    };

    const getUKPrimaryName = (namesData) => {
        const arr = safeParse(namesData);
        for (const n of arr) {
            if (n?.NameType === "Primary Name") {
                return n.Name6 || n.Name1 || n.Name2 || n.Name3 || n.Name4 || n.Name5 || "Unknown";
            }
        }
        return arr[0]?.Name6 || arr[0]?.Name1 || "Unknown";
    };

    const getEUPrimaryName = (namesData) => {
        const arr = safeParse(namesData);
        const nameObj = arr[0] || {};
        return [
            nameObj.first_name,
            nameObj.middle_name,
            nameObj.last_name,
            nameObj.whole_name
        ].filter(Boolean).join(' ') || "Unknown";
    };

    const renderResultsSection = (title, items, renderItem) => {
        if (!items || items.length === 0) return null;

        const Icon = ICONS_MAP[title] || <SearchIcon />;

        return (
            <Accordion
                key={title}
                defaultExpanded
                sx={{
                    mb: 2,
                    borderRadius: '8px !important',
                    '&:before': { display: 'none' },
                    border: '1px solid #e0e0e0',
                    boxShadow: 'none'
                }}
            >
                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: alpha('#DAA520', 0.1), borderRadius: '8px 8px 0 0' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ color: '#DAA520', display: 'flex' }}>{Icon}</Box>
                        <Typography variant="subtitle1" fontWeight="bold">
                            {title.replace(/_/g, ' ')}
                        </Typography>
                        <Chip label={items.length} size="small" color="warning" sx={{ ml: 1, height: 20 }} />
                    </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 2, bgcolor: '#fafafa' }}>
                    <Grid container spacing={2}>
                        {items.map((item, index) => (
                            <Grid item xs={12} sm={6} md={4} key={index}>
                                <Card variant="outlined" sx={{ height: '100%', borderColor: '#e0e0e0', transition: 'all 0.2s', '&:hover': { borderColor: '#DAA520', boxShadow: 2 } }}>
                                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                        {renderItem(item)}
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                </AccordionDetails>
            </Accordion>
        );
    };

    const totalResults = results ? Object.entries(results).reduce((acc, [k, v]) => acc + (Array.isArray(v) ? v.length : 0), 0) : 0;
    const hasResults = totalResults > 0;

    return (
        <Box sx={{ minHeight: "100vh", bgcolor: "#f5f5f5", py: isMobile ? 1 : 2 }}>
            <Container
                maxWidth={false}
                sx={{
                    width: "100%",
                    ml: 0,
                    px: { xs: 1, sm: 2, md: 0.5 },
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <SearchIcon sx={{ fontSize: 32, color: "#DAA520" }} />
                    <Typography variant={isMobile ? "h5" : "h4"} fontWeight="bold" color="#DAA520">
                        Global Search
                    </Typography>
                </Box>

                <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid #e0e0e0', bgcolor: '#fff', mb: 4 }}>
                    <form onSubmit={handleSearch}>
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
                            <TextField
                                fullWidth
                                variant="outlined"
                                placeholder="Search names across all 11 lists globally..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon color="action" />
                                        </InputAdornment>
                                    ),
                                    endAdornment: query && (
                                        <InputAdornment position="end">
                                            <IconButton onClick={clearSearch} edge="end" size="small">
                                                <ClearIcon />
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                    sx: { bgcolor: '#fafafa' }
                                }}
                            />
                            <Button
                                type="submit"
                                variant="contained"
                                disabled={loading || !query.trim()}
                                sx={{
                                    height: 56,
                                    px: 4,
                                    bgcolor: '#DAA520',
                                    color: '#000',
                                    fontWeight: 'bold',
                                    whiteSpace: 'nowrap',
                                    '&:hover': { bgcolor: '#b8860b' }
                                }}
                            >
                                {loading ? <CircularProgress size={24} color="inherit" /> : 'Search All'}
                            </Button>
                        </Box>
                    </form>
                </Paper>

                {results && (
                    <Box sx={{ mt: 4 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexDirection: 'row', flexWrap: 'wrap' }}>
                            <Typography variant="h6" fontWeight="bold">
                                Search Results
                            </Typography>
                            <Chip
                                label={hasResults ? `Found ${totalResults} matches` : 'No matches found'}
                                color={hasResults ? 'success' : 'default'}
                                variant="outlined"
                            />
                        </Box>

                        {!hasResults ? (
                            <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary', bgcolor: '#fff', borderRadius: 2, border: '1px solid #e0e0e0' }}>
                                <SearchIcon sx={{ fontSize: 64, opacity: 0.3, mb: 2 }} />
                                <Typography variant="h6">No records matched your search for "{query}".</Typography>
                                <Typography variant="body2" sx={{ mt: 1 }}>Try adjusting your search terms or checking your spelling.</Typography>
                            </Box>
                        ) : (
                            <Box>
                                {renderResultsSection("International_PEPs", results.International_PEPs, (item) => (
                                    <>
                                        <Typography variant="subtitle2" fontWeight="bold" color="primary">{item.name || item.fullName}</Typography>
                                        <Typography variant="body2" color="text.secondary" noWrap>Aliases: {item.aliases || 'None'}</Typography>
                                        <Typography variant="body2">Dataset: {item.dataset}</Typography>
                                    </>
                                ))}

                                {renderResultsSection("UK_Sanctions_List", results.UK_Sanctions_List, (item) => (
                                    <>
                                        <Typography variant="subtitle2" fontWeight="bold" color="error">{getUKPrimaryName(item.names)}</Typography>
                                        <Typography variant="body2">Regime: {item.regime}</Typography>
                                        <Typography variant="body2">Group Type: {item.group_type}</Typography>
                                    </>
                                ))}

                                {renderResultsSection("EU_Sanctions_List", results.EU_Sanctions_List, (item) => (
                                    <>
                                        <Typography variant="subtitle2" fontWeight="bold" color="error">{item.whole_name || item.name || getEUPrimaryName(item.name_aliases)}</Typography>
                                        <Typography variant="body2">Ref: {item.eu_reference_number}</Typography>
                                        <Typography variant="body2">Designation: {item.remark || item.designation_details || 'N/A'}</Typography>
                                    </>
                                ))}

                                {renderResultsSection("OFAC_Sanctions_List", results.OFAC_Sanctions_List, (item) => (
                                    <>
                                        <Typography variant="subtitle2" fontWeight="bold" color="error">{item.name || item.primary_name}</Typography>
                                        <Typography variant="body2" color="text.secondary">Type: {item.type || item.entity_type}</Typography>
                                        <Typography variant="body2">OFAC ID: {item.ofac_id}</Typography>
                                    </>
                                ))}

                                {renderResultsSection("UN_Sanctions_List", results.UN_Sanctions_List, (item) => (
                                    <>
                                        <Typography variant="subtitle2" fontWeight="bold" color="info.main">
                                            {[item.first_name, item.second_name, item.third_name].filter(Boolean).join(' ')}
                                        </Typography>
                                        <Typography variant="body2">Type: {item.list_type || item.un_list_type}</Typography>
                                        <Typography variant="body2" color="text.secondary">Ref: {item.reference_number || item.dataid}</Typography>
                                    </>
                                ))}

                                {renderResultsSection("UN_Designated_List", results.UN_Designated_List, (item) => (
                                    <>
                                        <Typography variant="subtitle2" fontWeight="bold" color="info.main">
                                            {[item.first_name, item.second_name, item.third_name].filter(Boolean).join(' ')}
                                        </Typography>
                                        <Typography variant="body2">Type: {item.list_type || item.un_list_type}</Typography>
                                        <Typography variant="body2" color="text.secondary">Ref: {item.reference_number || item.dataid}</Typography>
                                    </>
                                ))}

                                {renderResultsSection("Black_List", results.Black_List, (item) => (
                                    <>
                                        <Typography variant="subtitle2" fontWeight="bold">{item.name_of_suspected || item.name}</Typography>
                                        <Typography variant="body2">Phone: {item.phone_no || 'N/A'}</Typography>
                                        <Typography variant="body2" color="text.secondary">Offence: {item.predicate_offence || 'N/A'}</Typography>
                                    </>
                                ))}

                                {renderResultsSection("Deliquent_List", results.Deliquent_List, (item) => (
                                    <>
                                        <Typography variant="subtitle2" fontWeight="bold" color="warning.main">{item.customer_name || item.name}</Typography>
                                        <Typography variant="body2">TIN: {item.tin}</Typography>
                                        <Typography variant="body2" color="text.secondary">Ref: {item.reference_no}</Typography>
                                    </>
                                ))}

                                {renderResultsSection("ETH_List", results.ETH_List, (item) => (
                                    <>
                                        <Typography variant="subtitle2" fontWeight="bold">{item.name}</Typography>
                                    </>
                                ))}

                                {renderResultsSection("Local_PEPs", results.Local_PEPs, (item) => (
                                    <>
                                        <Typography variant="subtitle2" fontWeight="bold" color="primary">
                                            {item.nameeng || item.nameamh || 'Unknown'}
                                        </Typography>
                                        <Typography variant="body2">Position: {item.position || 'N/A'}</Typography>
                                        <Typography variant="body2" color="text.secondary">Assignment: {item.placeofassignment || 'N/A'}</Typography>
                                    </>
                                ))}

                                {renderResultsSection("PEP_Adverser_List", results.PEP_Adverser_List, (item) => (
                                    <>
                                        <Typography variant="subtitle2" fontWeight="bold" color="error">{item.name}</Typography>
                                        <Typography variant="body2">Details: {item.details || 'N/A'}</Typography>
                                    </>
                                ))}
                            </Box>
                        )}
                    </Box>
                )}

                <Snackbar
                    open={snackbar.open}
                    autoHideDuration={4000}
                    onClose={handleSnackbarClose}
                    anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                    <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>
                        {snackbar.message}
                    </Alert>
                </Snackbar>
            </Container>
        </Box>
    );
};

export default Search;