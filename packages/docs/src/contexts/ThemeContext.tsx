import { useState } from "react";

import { ThemeContext } from "./theme";

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const [isDarkMode, setIsDarkMode] = useState(() => {
        // Check for saved theme preference or default to light mode
        const saved = localStorage.getItem("docs-theme");
        return saved ? JSON.parse(saved) : false;
    });

    const toggleTheme = () => {
        const newMode = !isDarkMode;
        setIsDarkMode(newMode);
        localStorage.setItem("docs-theme", JSON.stringify(newMode));
    };

    return <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>{children}</ThemeContext.Provider>;
};
