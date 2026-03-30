import React from "react";

const categoryLabels = {
  workout: "Workout",
  study: "Study",
  meal: "Meal",
  k1: "K1 Training",
  other: "Other",
};

const iconButtonStyle = {
  width: "30px",
  height: "30px",
  borderRadius: "10px",
  border: "1px solid rgba(124, 180, 255, 0.16)",
  background: "rgba(255, 255, 255, 0.06)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "all 0.18s ease",
  color: "#dbe8fb",
  fontSize: "14px",
};

const ActivityCard = ({ activity, onDelete, onEdit, onToggleComplete }) => {
  const category = activity.category || "other";
  const isCompleted = !!activity.completed;

  return (
    <div
      className="activity-card"
      style={{
        borderLeft: `10px solid ${activity.color || "#cfe8d5"}`,
        opacity: isCompleted ? 0.76 : 1,
        transition: "opacity 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease",
        padding: "14px 16px 14px 18px",
        background: isCompleted
          ? "rgba(29, 39, 58, 0.78)"
          : "rgba(33, 43, 65, 0.92)",
        border: isCompleted
          ? "1px solid rgba(109, 132, 168, 0.18)"
          : "1px solid rgba(95, 123, 171, 0.22)",
        boxShadow: isCompleted
          ? "0 8px 20px rgba(0, 0, 0, 0.12)"
          : "0 10px 24px rgba(0, 0, 0, 0.18)",
      }}
    >
      <button
        type="button"
        onClick={onToggleComplete}
        title={isCompleted ? "Mark as not done" : "Mark as done"}
        aria-label={isCompleted ? "Mark as not done" : "Mark as done"}
        style={{
          position: "absolute",
          top: "14px",
          left: "14px",
          width: "22px",
          height: "22px",
          borderRadius: "999px",
          border: isCompleted ? "2px solid #33a852" : "2px solid #d6dfeb",
          background: isCompleted ? "#33a852" : "rgba(246, 249, 253, 0.96)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "12px",
          color: "#ffffff",
          cursor: "pointer",
          transition: "all 0.18s ease",
          boxShadow: isCompleted
            ? "0 0 0 4px rgba(51, 168, 82, 0.12)"
            : "0 3px 8px rgba(0, 0, 0, 0.18)",
        }}
      >
        {isCompleted ? "✓" : ""}
      </button>

      <div
        style={{
          position: "absolute",
          top: "12px",
          right: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        <button
          type="button"
          title="Delete entry"
          aria-label="Delete entry"
          onClick={onDelete}
          style={iconButtonStyle}
        >
          🗑
        </button>

        <button
          type="button"
          title="Edit entry"
          aria-label="Edit entry"
          onClick={onEdit}
          style={iconButtonStyle}
        >
          ✏️
        </button>
      </div>

      <div
        className="activity-top"
        style={{
          paddingLeft: "34px",
          paddingRight: "48px",
        }}
      >
        <div className="activity-main">
          <div
            className="activity-title-row"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
              marginBottom: "10px",
            }}
          >
            <h3
              style={{
                textDecoration: isCompleted ? "line-through" : "none",
                color: isCompleted ? "#98a7bb" : "#f5f8fd",
                margin: 0,
                fontSize: "28px",
                lineHeight: 1.05,
              }}
            >
              {activity.title}
            </h3>

            <span className={`category-badge ${category}`}>
              {categoryLabels[category]}
            </span>

            {isCompleted && (
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#84d69a",
                  background: "rgba(51, 168, 82, 0.14)",
                  border: "1px solid rgba(51, 168, 82, 0.22)",
                  borderRadius: "999px",
                  padding: "4px 8px",
                }}
              >
                Done
              </span>
            )}
          </div>

          <div
            className="entry-tags"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <span
              className="time-badge"
              style={{
                fontWeight: 800,
                letterSpacing: "0.01em",
              }}
            >
              {activity.start} - {activity.end}
            </span>

            <span
              className={
                activity.recurring
                  ? "entry-badge recurring"
                  : "entry-badge one-time"
              }
            >
              {activity.recurring ? "Weekly" : "One-time"}
            </span>
          </div>
        </div>
      </div>

      {activity.description && (
        <p
          className="activity-description"
          style={{
            textDecoration: isCompleted ? "line-through" : "none",
            color: isCompleted ? "#8e9aa6" : "#b8c4d6",
            marginLeft: "34px",
            marginTop: "10px",
            marginRight: "48px",
          }}
        >
          {activity.description}
        </p>
      )}
    </div>
  );
};

export default ActivityCard;