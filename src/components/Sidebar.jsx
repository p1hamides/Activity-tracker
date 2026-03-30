import React, { useContext } from "react";
import { NavLink } from "react-router-dom";
import { AppContext } from "../context/AppContext";

const Sidebar = () => {
  const {
    currentWeek,
    currentWeekLabel,
    goToPreviousWeek,
    goToNextWeek,
    goToCurrentWeek,
    weekOffset,
  } = useContext(AppContext);

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <h2 className="logo">PlanGrid</h2>
        <p className="sidebar-subtitle">Weekly planner</p>

        <div
          style={{
            marginTop: "18px",
            padding: "12px",
            borderRadius: "14px",
            background: "rgba(255,255,255,0.5)",
            border: "1px solid rgba(201,214,228,0.8)",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: "#5b6b7b",
              marginBottom: "8px",
            }}
          >
            Week
          </div>

          <div
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: "#284252",
              marginBottom: "10px",
            }}
          >
            {currentWeekLabel}
          </div>

          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={goToPreviousWeek}
              style={weekButtonStyle}
            >
              ←
            </button>
            <button
              type="button"
              onClick={goToCurrentWeek}
              style={{
                ...weekButtonStyle,
                fontSize: "12px",
                padding: "8px 10px",
                opacity: weekOffset === 0 ? 0.7 : 1,
              }}
            >
              Today
            </button>
            <button
              type="button"
              onClick={goToNextWeek}
              style={weekButtonStyle}
            >
              →
            </button>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {currentWeek.map((item) => (
          <NavLink
            key={item.dayName}
            to={`/${item.dayName}`}
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              border:
                item.isToday ? "1px solid rgba(47,157,245,0.35)" : undefined,
            }}
          >
            <span>{item.dayName}</span>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: item.isToday ? "#1d4f91" : "#6f8294",
              }}
            >
              {item.shortDate}
            </span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

const weekButtonStyle = {
  border: "1px solid #c8d7e6",
  background: "#ffffff",
  color: "#355372",
  borderRadius: "10px",
  padding: "8px 10px",
  cursor: "pointer",
  fontWeight: 700,
};

export default Sidebar;