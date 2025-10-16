import { AccountTree, Code, DarkMode, LightMode, MenuBook, Rocket } from "@mui/icons-material";
import { Box, Button, Card, CardContent, Chip, Container, Grid, IconButton, Paper, Tooltip, Typography } from "@mui/material";

import { useContext } from "react";

import { Link } from "react-router-dom";

import { ThemeContext } from "../contexts/theme";

export default function HomePage() {
    const { isDarkMode, toggleTheme } = useContext(ThemeContext);

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            {/* Header with Theme Toggle */}
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
                <Typography variant="h4" component="h1" sx={{ fontWeight: "bold" }}>
                    Developer Documentation
                </Typography>
                <Tooltip title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}>
                    <IconButton onClick={toggleTheme} size="large" sx={{ color: "text.secondary" }}>
                        {isDarkMode ? <LightMode /> : <DarkMode />}
                    </IconButton>
                </Tooltip>
            </Box>

            {/* Hero Section */}
            <Box sx={{ textAlign: "center", mb: 8 }}>
                <Chip label="👨‍💻 Developer Documentation" color="primary" variant="outlined" sx={{ mb: 3 }} />
                <Typography variant="h2" component="h1" sx={{ mb: 2, fontWeight: "bold" }}>
                    WingTechBot MK3
                </Typography>
                <Typography variant="h5" color="text.secondary" sx={{ mb: 4, maxWidth: 800, mx: "auto" }}>
                    Developer documentation for the modern full-stack Discord bot application built with TypeScript, featuring a robust backend API and a sleek React frontend.
                </Typography>
                <Box sx={{ display: "flex", gap: 2, justifyContent: "center", flexWrap: "wrap" }}>
                    <Button component={Link} to="/guide" variant="contained" size="large" startIcon={<Rocket />} sx={{ textTransform: "none" }}>
                        Start Development
                    </Button>
                    <Button component="a" href="https://github.com/ellman12/WingTechBot-MK3" target="_blank" rel="noopener noreferrer" variant="outlined" size="large" sx={{ textTransform: "none" }}>
                        View on GitHub
                    </Button>
                </Box>
            </Box>

            {/* Quick Start */}
            <Paper sx={{ p: 4, mb: 6 }}>
                <Typography variant="h4" component="h2" sx={{ mb: 3, fontWeight: "bold" }}>
                    🚀 Quick Start
                </Typography>
                <Box
                    sx={{
                        bgcolor: isDarkMode ? "#1a1a1a" : "#263238",
                        color: "#eeffff",
                        p: 3,
                        borderRadius: 2,
                        mb: 3,
                        fontFamily: "monospace",
                    }}>
                    <Box sx={{ mb: 2, color: "#b0bec5" }}>Terminal</Box>
                    <Box sx={{ mb: 1 }}>
                        <span style={{ color: "#4caf50" }}>$</span> git clone https://github.com/ellman12/WingTechBot-MK3.git
                    </Box>
                    <Box sx={{ mb: 1 }}>
                        <span style={{ color: "#4caf50" }}>$</span> cd WingTechBot-MK3
                    </Box>
                    <Box sx={{ mb: 1 }}>
                        <span style={{ color: "#4caf50" }}>$</span> pnpm install
                    </Box>
                    <Box>
                        <span style={{ color: "#4caf50" }}>$</span> pnpm dev:all
                    </Box>
                </Box>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                    Your application will be available at:
                </Typography>
                <Box component="ul" sx={{ pl: 2, color: "text.secondary" }}>
                    <li>
                        <strong>Backend API:</strong> http://localhost:3000
                    </li>
                    <li>
                        <strong>Frontend:</strong> http://localhost:5173
                    </li>
                    <li>
                        <strong>API Docs:</strong> http://localhost:3000/api/docs
                    </li>
                </Box>
            </Paper>

            {/* Features Grid */}
            <Grid container spacing={3} sx={{ mb: 6 }}>
                <Grid item xs={12} md={6}>
                    <Card sx={{ height: "100%" }}>
                        <CardContent>
                            <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                                <Code color="primary" sx={{ mr: 1, fontSize: 28 }} />
                                <Typography variant="h6" component="h3">
                                    Backend
                                </Typography>
                            </Box>
                            <Typography color="text.secondary" sx={{ mb: 2 }}>
                                Express.js API with Discord bot functionality, built with TypeScript and following hexagonal architecture principles.
                            </Typography>
                            <Button component={Link} to="/guide/backend" color="primary" sx={{ textTransform: "none" }}>
                                Learn more
                            </Button>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                    <Card sx={{ height: "100%" }}>
                        <CardContent>
                            <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                                <MenuBook color="primary" sx={{ mr: 1, fontSize: 28 }} />
                                <Typography variant="h6" component="h3">
                                    Frontend
                                </Typography>
                            </Box>
                            <Typography color="text.secondary" sx={{ mb: 2 }}>
                                Modern React application with Vite, TypeScript, Tailwind CSS, and state-of-the-art tooling for building user interfaces.
                            </Typography>
                            <Button component={Link} to="/guide/frontend" color="primary" sx={{ textTransform: "none" }}>
                                Learn more
                            </Button>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                    <Card sx={{ height: "100%" }}>
                        <CardContent>
                            <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                                <AccountTree color="primary" sx={{ mr: 1, fontSize: 28 }} />
                                <Typography variant="h6" component="h3">
                                    Architecture
                                </Typography>
                            </Box>
                            <Typography color="text.secondary" sx={{ mb: 2 }}>
                                Clean hexagonal architecture with clear separation of concerns, type safety throughout, and comprehensive testing.
                            </Typography>
                            <Button component={Link} to="/architecture" color="primary" sx={{ textTransform: "none" }}>
                                Learn more
                            </Button>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                    <Card sx={{ height: "100%" }}>
                        <CardContent>
                            <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                                <Rocket color="primary" sx={{ mr: 1, fontSize: 28 }} />
                                <Typography variant="h6" component="h3">
                                    Deployment
                                </Typography>
                            </Box>
                            <Typography color="text.secondary" sx={{ mb: 2 }}>
                                Docker support, CI/CD pipelines, and comprehensive deployment guides for production environments.
                            </Typography>
                            <Button component={Link} to="/guide/deployment" color="primary" sx={{ textTransform: "none" }}>
                                Learn more
                            </Button>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Technology Stack */}
            <Paper sx={{ p: 4, mb: 6 }}>
                <Typography variant="h4" component="h2" sx={{ mb: 4, fontWeight: "bold" }}>
                    🛠️ Development Stack
                </Typography>
                <Grid container spacing={4}>
                    <Grid item xs={12} md={6}>
                        <Typography variant="h6" sx={{ mb: 2, color: "primary.main" }}>
                            Backend
                        </Typography>
                        <Box component="ul" sx={{ pl: 2, color: "text.secondary" }}>
                            <li>
                                <strong>Express.js</strong> - Web framework
                            </li>
                            <li>
                                <strong>TypeScript</strong> - Type safety
                            </li>
                            <li>
                                <strong>Discord.js</strong> - Discord bot functionality
                            </li>
                            <li>
                                <strong>Kysely</strong> - Type-safe SQL queries
                            </li>
                            <li>
                                <strong>Hexagonal Architecture</strong> - Clean code organization
                            </li>
                        </Box>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Typography variant="h6" sx={{ mb: 2, color: "primary.main" }}>
                            Frontend
                        </Typography>
                        <Box component="ul" sx={{ pl: 2, color: "text.secondary" }}>
                            <li>
                                <strong>React 19</strong> - UI library
                            </li>
                            <li>
                                <strong>Vite</strong> - Build tool and dev server
                            </li>
                            <li>
                                <strong>TypeScript</strong> - Type safety
                            </li>
                            <li>
                                <strong>Tailwind CSS</strong> - Utility-first styling
                            </li>
                            <li>
                                <strong>Zustand</strong> - State management
                            </li>
                            <li>
                                <strong>TanStack Query</strong> - Data fetching and caching
                            </li>
                        </Box>
                    </Grid>
                </Grid>
            </Paper>

            {/* Developer Resources */}
            <Paper
                sx={{
                    p: 4,
                    background: isDarkMode ? "linear-gradient(135deg, #1a237e 0%, #0d47a1 100%)" : "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)",
                }}>
                <Typography variant="h4" component="h2" sx={{ mb: 3, fontWeight: "bold" }}>
                    🛠️ Developer Resources
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 4 }}>
                    This is the developer documentation. For user guides and tutorials, see the main documentation site.
                </Typography>
                <Grid container spacing={3}>
                    <Grid item xs={12} md={4}>
                        <Card sx={{ height: "100%" }}>
                            <CardContent sx={{ textAlign: "center" }}>
                                <MenuBook color="primary" sx={{ fontSize: 48, mb: 2 }} />
                                <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
                                    Development Guide
                                </Typography>
                                <Typography color="text.secondary" sx={{ mb: 2 }}>
                                    Complete setup and development workflow guide
                                </Typography>
                                <Button component={Link} to="/guide" variant="contained" sx={{ textTransform: "none" }}>
                                    Get Started
                                </Button>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid item xs={12} md={4}>
                        <Card sx={{ height: "100%" }}>
                            <CardContent sx={{ textAlign: "center" }}>
                                <Code color="primary" sx={{ fontSize: 48, mb: 2 }} />
                                <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
                                    API Reference
                                </Typography>
                                <Typography color="text.secondary" sx={{ mb: 2 }}>
                                    Complete API documentation and endpoints
                                </Typography>
                                <Button component={Link} to="/api" variant="contained" sx={{ textTransform: "none" }}>
                                    View API
                                </Button>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid item xs={12} md={4}>
                        <Card sx={{ height: "100%" }}>
                            <CardContent sx={{ textAlign: "center" }}>
                                <AccountTree color="primary" sx={{ fontSize: 48, mb: 2 }} />
                                <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
                                    System Architecture
                                </Typography>
                                <Typography color="text.secondary" sx={{ mb: 2 }}>
                                    System design and architectural patterns
                                </Typography>
                                <Button component={Link} to="/architecture" variant="contained" sx={{ textTransform: "none" }}>
                                    Learn More
                                </Button>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            </Paper>
        </Container>
    );
}
