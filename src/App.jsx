import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import DayPage from "./components/DayPage";
import { AppProvider } from "./context/AppContext.jsx";

const App = () => {
  const [darkMode, setDarkMode] = useState(() => {
    const savedMode = localStorage.getItem("planGridDarkMode");
    return savedMode === "true";
  });

  useEffect(() => {
    localStorage.setItem("planGridDarkMode", darkMode);
  }, [darkMode]);

  return (
    <AppProvider>
      <BrowserRouter>
        <div className={darkMode ? "app-shell dark" : "app-shell"}>
          <Sidebar />

          <main className="main-content">
            <div className="top-bar">
              <button
                className="secondary-button"
                onClick={() => setDarkMode(!darkMode)}
              >
                {darkMode ? "☀ Light Mode" : "🌙 Dark Mode"}
              </button>
            </div>

            <Routes>
              <Route path="/" element={<Navigate to="/Sunday" replace />} />
              {[
                "Sunday",
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
              ].map((day) => (
                <Route key={day} path={"/" + day} element={<DayPage day={day} />} />
              ))}
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AppProvider>
  );
};

export default App;