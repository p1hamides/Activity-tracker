import React, { useContext, useMemo, useState } from "react";
import { AppContext } from "../context/AppContext";
import ActivityCard from "./ActivityCard";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const toNumber = (value) => {
  const num = parseFloat(value);
  return Number.isNaN(num) ? 0 : num;
};

const waterToLiters = (amount, unit) => {
  const num = toNumber(amount);
  if (unit === "ml") return num / 1000;
  return num;
};

const formatWaterDisplay = (amount, unit) => {
  const num = toNumber(amount);

  if (!num) return "0 mL";

  if (unit === "ml") {
    if (num >= 1000) {
      const liters = num / 1000;
      if (Number.isInteger(liters)) return `${liters} L`;
      const wholeLiters = Math.floor(liters);
      const remainingMl = Math.round(num - wholeLiters * 1000);
      if (wholeLiters > 0) return `${wholeLiters} L ${remainingMl} mL`;
      return `${num} mL`;
    }
    return `${num} mL`;
  }

  if (Number.isInteger(num)) return `${num} L`;
  const wholeLiters = Math.floor(num);
  const remainingMl = Math.round((num - wholeLiters) * 1000);

  if (wholeLiters > 0) return `${wholeLiters} L ${remainingMl} mL`;
  return `${remainingMl} mL`;
};

const formatWaterGoalDisplay = (amount, unit) => {
  const num = toNumber(amount);
  if (!num) return "0 L";
  return unit === "ml" ? `${num} mL` : `${num} L`;
};

const clampPercent = (current, max) => {
  if (max <= 0) return 0;
  return Math.min((current / max) * 100, 100);
};

const timeToMinutes = (time) => {
  if (!time || !time.includes(":")) return 0;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

const isValidTimeRange = (start, end) => {
  if (!start || !end) return false;
  return timeToMinutes(end) > timeToMinutes(start);
};

const findOverlappingActivities = (
  activities,
  start,
  end,
  ignoredActivityId = null
) => {
  if (!start || !end || !isValidTimeRange(start, end)) return [];

  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);

  return activities.filter((activity) => {
    if (ignoredActivityId && activity.id === ignoredActivityId) {
      return false;
    }

    const activityStart = timeToMinutes(activity.start);
    const activityEnd = timeToMinutes(activity.end);

    return startMinutes < activityEnd && endMinutes > activityStart;
  });
};

const buildOverlapMessage = (overlappingEntries) => {
  if (overlappingEntries.length === 0) return "";

  if (overlappingEntries.length === 1) {
    const entry = overlappingEntries[0];
    return `Overlaps with "${entry.title}" (${entry.start} - ${entry.end})`;
  }

  const previewEntries = overlappingEntries
    .slice(0, 2)
    .map((entry) => `${entry.title} (${entry.start} - ${entry.end})`)
    .join(", ");

  const remainingCount = overlappingEntries.length - 2;

  return remainingCount > 0
    ? `Overlaps with ${previewEntries}, and ${remainingCount} more`
    : `Overlaps with ${previewEntries}`;
};

const formatHourLabel = (hour) => `${String(hour).padStart(2, "0")}:00`;

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOURS_AM = Array.from({ length: 12 }, (_, i) => i);
const HOURS_PM = Array.from({ length: 12 }, (_, i) => i + 12);
const MINUTE_OPTIONS = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

const TIMELINE_HOUR_HEIGHT = 80;
const DEFAULT_TIMELINE_START_HOUR = 6;
const DEFAULT_TIMELINE_END_HOUR = 26; // 02:00 next-day position

const getTimePartsFromValue = (time) => {
  if (!time || !time.includes(":")) {
    return {
      hour24: "",
      minute: "",
      meridiem: "",
    };
  }

  const [hourString, minute] = time.split(":");
  const hour24 = Number(hourString);

  if (Number.isNaN(hour24)) {
    return {
      hour24: "",
      minute: "",
      meridiem: "",
    };
  }

  return {
    hour24: String(hour24),
    minute,
    meridiem: hour24 >= 12 ? "PM" : "AM",
  };
};

const build24HourTime = (hour24, minute) => {
  if (hour24 === "" || !minute) return "";
  return `${String(Number(hour24)).padStart(2, "0")}:${minute}`;
};

const toTimelineDisplayMinutes = (time) => {
  const minutes = timeToMinutes(time);
  return minutes < DEFAULT_TIMELINE_START_HOUR * 60 ? minutes + 24 * 60 : minutes;
};

const getTimelineVisibleEndHour = (activities) => {
  const latestDisplayEnd = activities.reduce((max, activity) => {
    return Math.max(max, toTimelineDisplayMinutes(activity.end));
  }, DEFAULT_TIMELINE_END_HOUR * 60);

  return Math.max(
    DEFAULT_TIMELINE_END_HOUR,
    Math.ceil(latestDisplayEnd / 60)
  );
};

const assignTimelineColumns = (activities) => {
  const prepared = activities.map((activity) => ({
    ...activity,
    _timelineStart: toTimelineDisplayMinutes(activity.start),
    _timelineEnd: toTimelineDisplayMinutes(activity.end),
  }));

  const sorted = [...prepared].sort((a, b) => {
    const startDiff = a._timelineStart - b._timelineStart;
    if (startDiff !== 0) return startDiff;
    return a._timelineEnd - b._timelineEnd;
  });

  const columns = [];
  const placed = [];

  sorted.forEach((activity) => {
    let placedColumnIndex = 0;

    while (placedColumnIndex < columns.length) {
      if (activity._timelineStart >= columns[placedColumnIndex]) break;
      placedColumnIndex += 1;
    }

    columns[placedColumnIndex] = activity._timelineEnd;
    placed.push({
      ...activity,
      _timelineColumn: placedColumnIndex,
    });
  });

  return placed.map((activity) => {
    const overlapping = placed.filter(
      (other) =>
        activity.id !== other.id &&
        activity._timelineStart < other._timelineEnd &&
        activity._timelineEnd > other._timelineStart
    );

    const maxColumn = Math.max(
      activity._timelineColumn,
      ...overlapping.map((item) => item._timelineColumn)
    );

    return {
      ...activity,
      _timelineColumnCount: maxColumn + 1,
    };
  });
};

const TimeField = ({ label, value, onChange }) => {
  const initialParts = getTimePartsFromValue(value);

  const [selection, setSelection] = useState(initialParts);

  const syncFromValue = (nextValue) => {
    const nextParts = getTimePartsFromValue(nextValue);

    if (
      nextParts.hour24 !== selection.hour24 ||
      nextParts.minute !== selection.minute ||
      nextParts.meridiem !== selection.meridiem
    ) {
      setSelection(nextParts);
    }
  };

  if (value !== build24HourTime(selection.hour24, selection.minute)) {
    syncFromValue(value);
  }

  const commitIfComplete = (nextSelection) => {
    const completedValue = build24HourTime(
      nextSelection.hour24,
      nextSelection.minute
    );

    if (completedValue) {
      onChange(completedValue);
    } else if (
      nextSelection.hour24 === "" &&
      !nextSelection.minute &&
      !nextSelection.meridiem
    ) {
      onChange("");
    }
  };

  const handleMeridiemChange = (nextMeridiem) => {
    const hourOptions = nextMeridiem === "PM" ? HOURS_PM : HOURS_AM;

    let nextHour24 = selection.hour24;

    if (nextHour24 !== "" && !hourOptions.includes(Number(nextHour24))) {
      nextHour24 = "";
    }

    const nextSelection = {
      hour24: nextHour24,
      minute: nextHour24 !== "" ? selection.minute : "",
      meridiem: nextMeridiem,
    };

    setSelection(nextSelection);
    commitIfComplete(nextSelection);
  };

  const handleHourChange = (nextHour24) => {
    const nextSelection = {
      ...selection,
      hour24: nextHour24,
    };

    setSelection(nextSelection);
    commitIfComplete(nextSelection);
  };

  const handleMinuteChange = (nextMinute) => {
    if (selection.hour24 === "") {
      return;
    }

    const nextSelection = {
      ...selection,
      minute: nextMinute,
    };

    setSelection(nextSelection);
    commitIfComplete(nextSelection);
  };

  const hourOptions = selection.meridiem === "PM" ? HOURS_PM : HOURS_AM;

  const isComplete = Boolean(selection.hour24 !== "" && selection.minute);

  return (
    <div className="field">
      <label>{label}</label>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "10px",
          alignItems: "start",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "#7b8a9a",
              marginBottom: "6px",
            }}
          >
            Hour
          </div>

          <select
            value={selection.hour24}
            onChange={(e) => handleHourChange(e.target.value)}
            disabled={!selection.meridiem}
          >
            <option value="">
              {selection.meridiem ? "Choose hour" : "Pick AM/PM first"}
            </option>
            {hourOptions.map((hour) => (
              <option key={hour} value={String(hour)}>
                {formatHourLabel(hour)}
              </option>
            ))}
          </select>

          <div
            style={{
              display: "flex",
              gap: "10px",
              marginTop: "10px",
            }}
          >
            {["AM", "PM"].map((option) => {
              const checked = selection.meridiem === option;

              return (
                <label
                  key={option}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    cursor: "pointer",
                    opacity: 1,
                    fontSize: "12px",
                    fontWeight: 700,
                    color: checked ? "#24384c" : "#7b8a9a",
                    userSelect: "none",
                  }}
                >
                  <input
                    type="radio"
                    name={`${label}-meridiem`}
                    value={option}
                    checked={checked}
                    onChange={() => handleMeridiemChange(option)}
                    style={{
                      appearance: "none",
                      width: "14px",
                      height: "14px",
                      borderRadius: "999px",
                      border: checked ? "2px solid #33a852" : "2px solid #c8d4e3",
                      background: checked ? "#33a852" : "#ffffff",
                      margin: 0,
                      transition: "all 0.18s ease",
                      cursor: "pointer",
                      boxShadow: checked
                        ? "0 0 0 3px rgba(51, 168, 82, 0.16)"
                        : "none",
                    }}
                  />
                  <span>{option}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "#7b8a9a",
              marginBottom: "6px",
            }}
          >
            Minute
          </div>

          <select
            value={selection.minute}
            onChange={(e) => handleMinuteChange(e.target.value)}
            disabled={selection.hour24 === ""}
          >
            <option value="">
              {selection.hour24 !== "" ? "Choose minute" : "Pick hour first"}
            </option>
            {MINUTE_OPTIONS.map((minuteOption) => (
              <option key={minuteOption} value={minuteOption}>
                {minuteOption}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        style={{
          marginTop: "8px",
          fontSize: "12px",
          fontWeight: 600,
          color: isComplete ? "#516273" : "#9aa6b2",
        }}
      >
        {isComplete
          ? `Selected: ${build24HourTime(
              selection.hour24,
              selection.minute
            )}`
          : "Choose AM/PM, then hour, then minute"}
      </div>
    </div>
  );
};

const DayPage = ({ day }) => {
  const {
    addActivity,
    updateActivity,
    toggleActivityCompleted,
    deleteActivity,
    reorderActivities,
    updateDayStats,
    streaks,
    currentWeek,
    getDateKeyForDay,
    getStatsForDate,
    getActivitiesForDate,
  } = useContext(AppContext);

  const [form, setForm] = useState({
    title: "",
    start: "",
    end: "",
    color: "#cfe8d5",
    description: "",
    recurring: false,
    category: "other",
  });

  const [timeError, setTimeError] = useState("");
  const [overlapWarning, setOverlapWarning] = useState("");
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [showStatsForm, setShowStatsForm] = useState(false);
  const [viewMode, setViewMode] = useState("list");

  const currentDayMeta = currentWeek.find((d) => d.dayName === day);
  const dateKey = getDateKeyForDay(day);
  const stats = getStatsForDate(dateKey);
  const dayEntries = getActivitiesForDate(dateKey);

  const shouldShowForm = useMemo(() => {
    return dayEntries.length === 0 || showEntryForm;
  }, [dayEntries.length, showEntryForm]);

  const showTrackerArea = shouldShowForm || showStatsForm;

  const caloriesCurrent = toNumber(stats.calories);
  const caloriesGoal = toNumber(stats.caloriesGoal);

  const waterCurrentLiters = waterToLiters(stats.waterAmount, stats.waterUnit);
  const waterGoalLiters = waterToLiters(stats.waterGoal, stats.waterGoalUnit);

  const sleepCurrent = toNumber(stats.sleepHours);
  const sleepGoal = toNumber(stats.sleepGoal);

  const caloriesPercent = clampPercent(caloriesCurrent, caloriesGoal);
  const waterPercent = clampPercent(waterCurrentLiters, waterGoalLiters);
  const sleepPercent = clampPercent(sleepCurrent, sleepGoal);

  const activeEntries = dayEntries.filter((activity) => !activity.completed);
  const completedEntries = dayEntries.filter((activity) => !!activity.completed);

  const sortedActiveEntries = [...activeEntries].sort(
    (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)
  );

  const sortedCompletedEntries = [...completedEntries].sort(
    (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)
  );

  const timelineEntries = useMemo(() => {
    return assignTimelineColumns([...sortedActiveEntries, ...sortedCompletedEntries]);
  }, [sortedActiveEntries, sortedCompletedEntries]);

  const timelineVisibleEndHour = useMemo(() => {
    return getTimelineVisibleEndHour([...sortedActiveEntries, ...sortedCompletedEntries]);
  }, [sortedActiveEntries, sortedCompletedEntries]);

  const timelineVisibleHours = useMemo(() => {
    return Array.from(
      { length: timelineVisibleEndHour - DEFAULT_TIMELINE_START_HOUR + 1 },
      (_, index) => DEFAULT_TIMELINE_START_HOUR + index
    );
  }, [timelineVisibleEndHour]);

  const timelineTotalHeight =
    (timelineVisibleEndHour - DEFAULT_TIMELINE_START_HOUR + 1) *
    TIMELINE_HOUR_HEIGHT;

  const completedEntriesCount = completedEntries.length;
  const totalEntriesCount = dayEntries.length;
  const dailyCompletionPercent =
    totalEntriesCount > 0 ? Math.round((completedEntriesCount / totalEntriesCount) * 100) : 0;
  const remainingEntriesCount = Math.max(totalEntriesCount - completedEntriesCount, 0);

  const resetFormState = () => {
    setForm({
      title: "",
      start: "",
      end: "",
      color: "#cfe8d5",
      description: "",
      recurring: false,
      category: "other",
    });
    setEditingEntryId(null);
    setTimeError("");
    setOverlapWarning("");
  };

  const updateTimeFeedback = (start, end, ignoredActivityId = editingEntryId) => {
    if (!start || !end) {
      setTimeError("");
      setOverlapWarning("");
      return;
    }

    if (!isValidTimeRange(start, end)) {
      setTimeError("End time must be later than start time");
      setOverlapWarning("");
      return;
    }

    setTimeError("");

    const overlappingEntries = findOverlappingActivities(
      dayEntries,
      start,
      end,
      ignoredActivityId
    );

    setOverlapWarning(buildOverlapMessage(overlappingEntries));
  };

  const handleChange = (field, value) => {
    const nextForm = {
      ...form,
      [field]: value,
    };

    setForm(nextForm);

    if (field === "start" || field === "end") {
      updateTimeFeedback(nextForm.start, nextForm.end);
    }
  };

  const handleEdit = (activity) => {
    setForm({
      id: activity.id,
      title: activity.title || "",
      start: activity.start || "",
      end: activity.end || "",
      color: activity.color || "#cfe8d5",
      description: activity.description || "",
      recurring: !!activity.recurring,
      category: activity.category || "other",
      completed: !!activity.completed,
    });
    setEditingEntryId(activity.id);
    setShowEntryForm(true);
    setTimeError("");
    updateTimeFeedback(activity.start, activity.end, activity.id);
  };

  const handleCancelEdit = () => {
    resetFormState();
    if (dayEntries.length > 0) {
      setShowEntryForm(false);
    }
  };

  const handleAdd = () => {
    if (!form.title || !form.start || !form.end) {
      setTimeError("Please fill all required fields");
      setOverlapWarning("");
      return;
    }

    if (!isValidTimeRange(form.start, form.end)) {
      setTimeError("End time must be later than start time");
      setOverlapWarning("");
      return;
    }

    const overlappingEntries = findOverlappingActivities(
      dayEntries,
      form.start,
      form.end,
      editingEntryId
    );

    setOverlapWarning(buildOverlapMessage(overlappingEntries));
    setTimeError("");

    if (editingEntryId) {
      updateActivity(dateKey, {
        ...form,
        id: editingEntryId,
      });
    } else {
      addActivity(dateKey, form);
    }

    resetFormState();
    setShowEntryForm(false);
  };

  const handleStatsChange = (field, value) => {
    updateDayStats(dateKey, {
      [field]: value,
    });
  };

  const handleStatsSave = () => {
    setShowStatsForm(false);
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(sortedActiveEntries);
    const [movedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, movedItem);

    reorderActivities(dateKey, [...items, ...sortedCompletedEntries]);
  };

  const foodStreakActive = (streaks?.calories || 0) >= 4;
  const waterStreakActive = (streaks?.water || 0) >= 4;
  const sleepStreakActive = (streaks?.sleep || 0) >= 4;

  return (
    <div className="day-page">
      <div className="day-header">
        <div>
          <h1>{day}</h1>
          <p>
            {currentDayMeta?.longDate || dateKey} · Track your daily schedule,
            food, water, and sleep.
          </p>
        </div>

        <div
          className="header-actions"
          style={{
            alignItems: "stretch",
            gap: "12px",
          }}
        >
          <div
            style={{
              minWidth: "250px",
              background: "linear-gradient(180deg, rgba(28, 36, 56, 0.96) 0%, rgba(20, 27, 44, 0.96) 100%)",
              border: "1px solid rgba(94, 120, 165, 0.22)",
              borderRadius: "18px",
              padding: "14px 16px",
              boxShadow: "0 12px 30px rgba(0, 0, 0, 0.22)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              backdropFilter: "blur(12px)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                marginBottom: "10px",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  color: "#8aa2c2",
                  textTransform: "uppercase",
                }}
              >
                Daily progress
              </span>

              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 800,
                  color: completedEntriesCount > 0 ? "#c8f3d4" : "#b1bfd1",
                  background:
                    completedEntriesCount > 0
                      ? "rgba(51, 168, 82, 0.16)"
                      : "rgba(124, 180, 255, 0.12)",
                  border:
                    completedEntriesCount > 0
                      ? "1px solid rgba(51, 168, 82, 0.18)"
                      : "1px solid rgba(124, 180, 255, 0.16)",
                  borderRadius: "999px",
                  padding: "5px 10px",
                }}
              >
                {completedEntriesCount} / {totalEntriesCount} done
              </span>
            </div>

            <div
              style={{
                height: "10px",
                borderRadius: "999px",
                background: "rgba(72, 89, 120, 0.55)",
                overflow: "hidden",
                marginBottom: "10px",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${dailyCompletionPercent}%`,
                  borderRadius: "999px",
                  background:
                    dailyCompletionPercent === 100
                      ? "linear-gradient(90deg, #33a852 0%, #57c271 100%)"
                      : "linear-gradient(90deg, #7cb4ff 0%, #33a852 100%)",
                  transition: "width 0.22s ease",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "10px",
                fontSize: "13px",
                color: "#9db0c7",
                fontWeight: 600,
              }}
            >
              <span>{dailyCompletionPercent}% complete</span>
              <span>
                {remainingEntriesCount === 0
                  ? totalEntriesCount > 0
                    ? "All done"
                    : "No entries yet"
                  : `${remainingEntriesCount} left`}
              </span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "8px",
              alignItems: "center",
              background: "rgba(24, 32, 50, 0.88)",
              border: "1px solid rgba(96, 121, 166, 0.2)",
              borderRadius: "14px",
              padding: "6px",
              height: "fit-content",
              alignSelf: "center",
              boxShadow: "0 10px 22px rgba(0, 0, 0, 0.16)",
            }}
          >
            <button
              className="secondary-button"
              type="button"
              onClick={() => setViewMode("list")}
              style={{
                padding: "9px 14px",
                background: viewMode === "list" ? "rgba(124, 180, 255, 0.18)" : "transparent",
                borderColor: viewMode === "list" ? "rgba(124, 180, 255, 0.22)" : "transparent",
                color: viewMode === "list" ? "#eef5ff" : "#b4c3d7",
              }}
            >
              List
            </button>

            <button
              className="secondary-button"
              type="button"
              onClick={() => setViewMode("timeline")}
              style={{
                padding: "9px 14px",
                background: viewMode === "timeline" ? "rgba(124, 180, 255, 0.18)" : "transparent",
                borderColor: viewMode === "timeline" ? "rgba(124, 180, 255, 0.22)" : "transparent",
                color: viewMode === "timeline" ? "#eef5ff" : "#b4c3d7",
              }}
            >
              Timeline
            </button>
          </div>

          {!showStatsForm && (
            <div
              className="stats-mini-panel"
              onClick={() => setShowStatsForm(true)}
              title="Open daily stats"
            >
              <div className="mini-stat-row">
                <div className="mini-stat-top">
                  <span className="mini-stat-label">Food</span>
                  <span className="mini-stat-value">
                    {caloriesCurrent} / {caloriesGoal || 0} cal
                  </span>
                </div>
                <div className="mini-progress-track food-track">
                  <div
                    className="mini-progress-fill food-fill"
                    style={{ width: `${caloriesPercent}%` }}
                  />
                </div>
                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "12px",
                    fontWeight: 700,
                    color: foodStreakActive ? "#f7931e" : "#9aa6b2",
                    opacity: foodStreakActive ? 1 : 0.7,
                  }}
                >
                  🔥 {streaks?.calories || 0} day streak
                </div>
              </div>

              <div className="mini-stat-row">
                <div className="mini-stat-top">
                  <span className="mini-stat-label">Water</span>
                  <span className="mini-stat-value">
                    {formatWaterDisplay(stats.waterAmount, stats.waterUnit)} /{" "}
                    {formatWaterGoalDisplay(stats.waterGoal, stats.waterGoalUnit)}
                  </span>
                </div>
                <div className="mini-progress-track water-track">
                  <div
                    className="mini-progress-fill water-fill"
                    style={{ width: `${waterPercent}%` }}
                  />
                </div>
                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "12px",
                    fontWeight: 700,
                    color: waterStreakActive ? "#2f9df5" : "#9aa6b2",
                    opacity: waterStreakActive ? 1 : 0.7,
                  }}
                >
                  💧 {streaks?.water || 0} day streak
                </div>
              </div>

              <div className="mini-stat-row">
                <div className="mini-stat-top">
                  <span className="mini-stat-label">Sleep</span>
                  <span className="mini-stat-value">
                    {sleepCurrent || 0}h / {sleepGoal || 0}h
                  </span>
                </div>
                <div className="mini-progress-track sleep-track">
                  <div
                    className="mini-progress-fill sleep-fill"
                    style={{ width: `${sleepPercent}%` }}
                  />
                </div>
                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "12px",
                    fontWeight: 700,
                    color: sleepStreakActive ? "#8d59d9" : "#9aa6b2",
                    opacity: sleepStreakActive ? 1 : 0.7,
                  }}
                >
                  😴 {streaks?.sleep || 0} day streak
                </div>
              </div>
            </div>
          )}

          {dayEntries.length > 0 && !shouldShowForm && (
            <button
              className="primary-button"
              onClick={() => {
                resetFormState();
                setShowEntryForm(true);
              }}
              style={{
                alignSelf: "flex-start",
                background: "linear-gradient(180deg, rgba(134, 219, 228, 0.95) 0%, rgba(113, 197, 213, 0.95) 100%)",
                boxShadow: "0 10px 22px rgba(81, 173, 194, 0.18)",
                filter: "none",
              }}
            >
              Add entry
            </button>
          )}
        </div>
      </div>

      {showTrackerArea && (
        <div
          className="tracker-layout"
          style={{
            gridTemplateColumns:
              shouldShowForm && showStatsForm ? "340px 1fr" : "1fr",
          }}
        >
          {showStatsForm && (
            <section className="daily-stats-card">
              <div className="tracker-header-row">
                <div className="tracker-header">
                  <h2>Daily tracker</h2>
                  <span className="tracker-subtle">
                    {currentDayMeta?.longDate || dateKey} · Current values + max goals
                  </span>
                </div>

                <button className="secondary-button" onClick={handleStatsSave}>
                  Done
                </button>
              </div>

              <div className="tracker-stack">
                <div className="tracker-row">
                  <div className="tracker-icon calories-icon">🔥</div>
                  <div className="tracker-content">
                    <label>Calories</label>
                    <div className="stats-dual-grid">
                      <input
                        type="number"
                        placeholder="Current calories"
                        value={stats.calories}
                        onChange={(e) => handleStatsChange("calories", e.target.value)}
                      />
                      <input
                        type="number"
                        placeholder="Goal calories"
                        value={stats.caloriesGoal}
                        onChange={(e) => handleStatsChange("caloriesGoal", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="tracker-row">
                  <div className="tracker-icon water-icon">💧</div>
                  <div className="tracker-content">
                    <label>Water</label>
                    <div className="stats-water-block">
                      <div className="tracker-inline">
                        <input
                          type="number"
                          placeholder="Current water"
                          value={stats.waterAmount}
                          onChange={(e) => handleStatsChange("waterAmount", e.target.value)}
                        />
                        <select
                          value={stats.waterUnit}
                          onChange={(e) => handleStatsChange("waterUnit", e.target.value)}
                        >
                          <option value="ml">mL</option>
                          <option value="l">L</option>
                        </select>
                      </div>

                      <div className="tracker-inline">
                        <input
                          type="number"
                          placeholder="Goal water"
                          value={stats.waterGoal}
                          onChange={(e) => handleStatsChange("waterGoal", e.target.value)}
                        />
                        <select
                          value={stats.waterGoalUnit}
                          onChange={(e) => handleStatsChange("waterGoalUnit", e.target.value)}
                        >
                          <option value="ml">mL</option>
                          <option value="l">L</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="tracker-row">
                  <div className="tracker-icon sleep-icon">😴</div>
                  <div className="tracker-content">
                    <label>Sleep hours</label>
                    <div className="stats-dual-grid">
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Current sleep"
                        value={stats.sleepHours}
                        onChange={(e) => handleStatsChange("sleepHours", e.target.value)}
                      />
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Goal sleep"
                        value={stats.sleepGoal}
                        onChange={(e) => handleStatsChange("sleepGoal", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {shouldShowForm && (
            <section className="form-card">
              <div className="form-top-row">
                <h2>{editingEntryId ? "Edit entry" : "Add entry"}</h2>

                <div style={{ display: "flex", gap: "8px" }}>
                  {editingEntryId && (
                    <button
                      className="secondary-button"
                      onClick={handleCancelEdit}
                    >
                      Cancel editing
                    </button>
                  )}

                  {dayEntries.length > 0 && (
                    <button
                      className="secondary-button"
                      onClick={() => {
                        resetFormState();
                        setShowEntryForm(false);
                      }}
                    >
                      Back to schedule
                    </button>
                  )}
                </div>
              </div>

              {editingEntryId && form.recurring && (
                <div
                  style={{
                    marginBottom: "12px",
                    borderRadius: "14px",
                    padding: "12px 14px",
                    background: "rgba(124, 180, 255, 0.09)",
                    border: "1px solid rgba(124, 180, 255, 0.15)",
                    color: "#b7c9df",
                    fontSize: "13px",
                    fontWeight: 600,
                    lineHeight: 1.5,
                  }}
                >
                  This entry is marked as a <strong style={{ color: "#eef5ff" }}>weekly recurring item</strong>.
                  In the current version of PlanGrid, editing this form updates this saved entry itself, not a linked full recurring series.
                </div>
              )}

              <div className="form-grid">
                <div className="field">
                  <label>Title</label>
                  <input
                    type="text"
                    placeholder="Gym, meal prep, lunch, study..."
                    value={form.title}
                    onChange={(e) => handleChange("title", e.target.value)}
                  />
                </div>

                <TimeField
                  label="Start time"
                  value={form.start}
                  onChange={(value) => handleChange("start", value)}
                />

                <TimeField
                  label="End time"
                  value={form.end}
                  onChange={(value) => handleChange("end", value)}
                />

                <div className="field">
                  <label>Color</label>
                  <div className="color-swatch-wrapper">
                    <label
                      className="color-swatch"
                      style={{ backgroundColor: form.color }}
                      title="Choose entry color"
                    >
                      <input
                        type="color"
                        value={form.color}
                        onChange={(e) => handleChange("color", e.target.value)}
                        className="color-swatch-input"
                      />
                    </label>
                  </div>
                </div>

                <div className="field">
                  <label>Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => handleChange("category", e.target.value)}
                  >
                    <option value="workout">Workout</option>
                    <option value="study">Study</option>
                    <option value="meal">Meal</option>
                    <option value="k1">K1 Training</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="field field-full">
                  <label>Description</label>
                  <textarea
                    placeholder="Optional notes..."
                    value={form.description}
                    onChange={(e) => handleChange("description", e.target.value)}
                  />
                </div>

                <div className="field field-full recurring-field">
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={form.recurring}
                      onChange={(e) => handleChange("recurring", e.target.checked)}
                    />
                    <span>Recurring weekly item</span>
                  </label>
                  <small>
                    Weekly recurrence is currently stored as a recurring flag on this entry for planner behavior and visibility.
                  </small>
                </div>
              </div>

              {timeError && (
                <div
                  style={{
                    color: "#d93025",
                    fontSize: "13px",
                    fontWeight: 600,
                    marginBottom: "10px",
                  }}
                >
                  {timeError}
                </div>
              )}

              {!timeError && overlapWarning && (
                <div
                  style={{
                    color: "#b26a00",
                    background: "rgba(255, 196, 87, 0.14)",
                    border: "1px solid rgba(255, 196, 87, 0.38)",
                    borderRadius: "12px",
                    padding: "10px 12px",
                    fontSize: "13px",
                    fontWeight: 600,
                    marginBottom: "10px",
                  }}
                >
                  {overlapWarning}
                </div>
              )}

              <button
                className="primary-button"
                onClick={handleAdd}
                disabled={!!timeError}
                style={{
                  opacity: timeError ? 0.6 : 1,
                  cursor: timeError ? "not-allowed" : "pointer",
                }}
              >
                {editingEntryId ? "Save changes" : "Add entry"}
              </button>
            </section>
          )}
        </div>
      )}

      <section className="activities-section">
        <div className="section-title-row">
          <h2>{viewMode === "timeline" ? "Timeline view" : "Day entries"}</h2>
          <div className="section-actions">
            <span className="activity-count">{dayEntries.length} items</span>

            {dayEntries.length > 0 && shouldShowForm && (
              <button
                className="secondary-button"
                onClick={() => {
                  resetFormState();
                  setShowEntryForm(false);
                }}
              >
                Hide form
              </button>
            )}
          </div>
        </div>

        {viewMode === "list" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <section
              style={{
                border: "1px solid rgba(86, 111, 154, 0.22)",
                borderRadius: "20px",
                background: "linear-gradient(180deg, rgba(28, 36, 56, 0.9) 0%, rgba(22, 28, 46, 0.9) 100%)",
                padding: "18px",
                boxShadow: "0 14px 30px rgba(0, 0, 0, 0.18)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                  marginBottom: "14px",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "16px",
                      fontWeight: 800,
                      color: "#eef4ff",
                    }}
                  >
                    Active entries
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#7f93ae",
                      marginTop: "2px",
                    }}
                  >
                    Focus on what is still left today
                  </div>
                </div>

                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 800,
                    color: "#d8e7ff",
                    background: "rgba(124, 180, 255, 0.12)",
                    border: "1px solid rgba(124, 180, 255, 0.16)",
                    borderRadius: "999px",
                    padding: "6px 10px",
                  }}
                >
                  {sortedActiveEntries.length}
                </span>
              </div>

              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId={`entries-${day}`}>
                  {(provided) => (
                    <div
                      className="activities-list"
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                    >
                      {sortedActiveEntries.length === 0 ? (
                        <div
                          className="empty-state"
                          style={{
                            margin: 0,
                            background: "rgba(23, 30, 46, 0.8)",
                            border: "1px solid rgba(81, 104, 144, 0.18)",
                          }}
                        >
                          <h3>No active entries</h3>
                          <p>
                            {sortedCompletedEntries.length > 0
                              ? "Everything for this day is completed."
                              : `Add your first item for ${day} above.`}
                          </p>
                        </div>
                      ) : (
                        sortedActiveEntries.map((activity, index) => (
                          <Draggable
                            key={activity.id}
                            draggableId={String(activity.id)}
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                style={provided.draggableProps.style}
                                className={snapshot.isDragging ? "dragging-item" : ""}
                              >
                                <ActivityCard
                                  activity={activity}
                                  onDelete={() => deleteActivity(dateKey, activity.id)}
                                  onEdit={() => handleEdit(activity)}
                                  onToggleComplete={() =>
                                    toggleActivityCompleted(dateKey, activity.id)
                                  }
                                />
                              </div>
                            )}
                          </Draggable>
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </section>

            {sortedCompletedEntries.length > 0 && (
              <section
                style={{
                  border: "1px solid rgba(51, 168, 82, 0.16)",
                  borderRadius: "20px",
                  background: "linear-gradient(180deg, rgba(24, 35, 40, 0.88) 0%, rgba(20, 30, 34, 0.88) 100%)",
                  padding: "18px",
                  boxShadow: "0 12px 26px rgba(0, 0, 0, 0.16)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "10px",
                    marginBottom: "14px",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "16px",
                        fontWeight: 800,
                        color: "#c9f4d5",
                      }}
                    >
                      Completed today
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#89a096",
                        marginTop: "2px",
                      }}
                    >
                      Finished items stay here for quick review
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 800,
                      color: "#c9f4d5",
                      background: "rgba(51, 168, 82, 0.12)",
                      border: "1px solid rgba(51, 168, 82, 0.18)",
                      borderRadius: "999px",
                      padding: "6px 10px",
                    }}
                  >
                    {sortedCompletedEntries.length} done
                  </span>
                </div>

                <div className="activities-list">
                  {sortedCompletedEntries.map((activity) => (
                    <ActivityCard
                      key={activity.id}
                      activity={activity}
                      onDelete={() => deleteActivity(dateKey, activity.id)}
                      onEdit={() => handleEdit(activity)}
                      onToggleComplete={() =>
                        toggleActivityCompleted(dateKey, activity.id)
                      }
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div
            style={{
              border: "1px solid rgba(86, 111, 154, 0.22)",
              borderRadius: "20px",
              background: "linear-gradient(180deg, rgba(28, 36, 56, 0.9) 0%, rgba(22, 28, 46, 0.9) 100%)",
              boxShadow: "0 14px 30px rgba(0, 0, 0, 0.18)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "relative",
                height: `${timelineTotalHeight}px`,
                display: "grid",
                gridTemplateColumns: "88px 1fr",
              }}
            >
              <div
                style={{
                  position: "relative",
                  borderRight: "1px solid rgba(86, 111, 154, 0.18)",
                  background: "rgba(19, 26, 42, 0.44)",
                }}
              >
                {timelineVisibleHours.map((displayHour) => (
                  <div
                    key={displayHour}
                    style={{
                      position: "absolute",
                      top: `${(displayHour - DEFAULT_TIMELINE_START_HOUR) * TIMELINE_HOUR_HEIGHT}px`,
                      left: 0,
                      right: 0,
                      height: `${TIMELINE_HOUR_HEIGHT}px`,
                      padding: "10px 12px",
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#8ea2bd",
                      borderTop:
                        displayHour === DEFAULT_TIMELINE_START_HOUR
                          ? "none"
                          : "1px solid rgba(86, 111, 154, 0.14)",
                    }}
                  >
                    {formatHourLabel(displayHour % 24)}
                  </div>
                ))}
              </div>

              <div
                style={{
                  position: "relative",
                  background: "rgba(14, 20, 34, 0.16)",
                }}
              >
                {timelineVisibleHours.map((displayHour) => (
                  <div
                    key={displayHour}
                    style={{
                      position: "absolute",
                      top: `${(displayHour - DEFAULT_TIMELINE_START_HOUR) * TIMELINE_HOUR_HEIGHT}px`,
                      left: 0,
                      right: 0,
                      height: `${TIMELINE_HOUR_HEIGHT}px`,
                      borderTop:
                        displayHour === DEFAULT_TIMELINE_START_HOUR
                          ? "none"
                          : "1px solid rgba(86, 111, 154, 0.14)",
                    }}
                  />
                ))}

                {timelineEntries.map((activity) => {
                  const isCompleted = !!activity.completed;
                  const top =
                    ((activity._timelineStart - DEFAULT_TIMELINE_START_HOUR * 60) /
                      60) *
                    TIMELINE_HOUR_HEIGHT;
                  const rawHeight =
                    ((activity._timelineEnd - activity._timelineStart) / 60) *
                    TIMELINE_HOUR_HEIGHT;
                  const height = Math.max(rawHeight, 44);
                  const columnWidth = 100 / activity._timelineColumnCount;
                  const left = activity._timelineColumn * columnWidth;

                  return (
                    <div
                      key={activity.id}
                      style={{
                        position: "absolute",
                        top: `${top}px`,
                        left: `calc(${left}% + 8px)`,
                        width: `calc(${columnWidth}% - 16px)`,
                        height: `${height}px`,
                        minHeight: "44px",
                        borderRadius: "16px",
                        borderLeft: `8px solid ${activity.color || "#cfe8d5"}`,
                        border: isCompleted
                          ? "1px solid rgba(109, 132, 168, 0.18)"
                          : "1px solid rgba(95, 123, 171, 0.22)",
                        background: isCompleted
                          ? "rgba(29, 39, 58, 0.88)"
                          : "rgba(33, 43, 65, 0.96)",
                        boxShadow: "0 8px 18px rgba(0, 0, 0, 0.18)",
                        padding: "10px 12px 10px 14px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "8px",
                          marginBottom: "4px",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleActivityCompleted(dateKey, activity.id)}
                          title={isCompleted ? "Mark as not done" : "Mark as done"}
                          aria-label={isCompleted ? "Mark as not done" : "Mark as done"}
                          style={{
                            width: "18px",
                            height: "18px",
                            borderRadius: "999px",
                            border: isCompleted
                              ? "2px solid #33a852"
                              : "2px solid #d6dfeb",
                            background: isCompleted ? "#33a852" : "rgba(246, 249, 253, 0.96)",
                            color: "#ffffff",
                            fontSize: "10px",
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            flexShrink: 0,
                            marginTop: "1px",
                          }}
                        >
                          {isCompleted ? "✓" : ""}
                        </button>

                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontWeight: 800,
                              color: isCompleted ? "#98a7bb" : "#f5f8fd",
                              textDecoration: isCompleted ? "line-through" : "none",
                              fontSize: "13px",
                              lineHeight: 1.2,
                              marginBottom: "3px",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {activity.title}
                          </div>

                          <div
                            style={{
                              fontSize: "12px",
                              color: "#b6c4d7",
                              textDecoration: isCompleted ? "line-through" : "none",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {activity.start} - {activity.end}
                          </div>

                          {height >= 72 && activity.description ? (
                            <div
                              style={{
                                marginTop: "6px",
                                fontSize: "11px",
                                color: isCompleted ? "#8e9aa6" : "#9fb0c7",
                                textDecoration: isCompleted ? "line-through" : "none",
                                overflow: "hidden",
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                              }}
                            >
                              {activity.description}
                            </div>
                          ) : null}
                        </div>

                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                            flexShrink: 0,
                            marginLeft: "6px",
                          }}
                        >
                          {isCompleted ? (
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: 700,
                                color: "#84d69a",
                                background: "rgba(51, 168, 82, 0.12)",
                                border: "1px solid rgba(51, 168, 82, 0.22)",
                                borderRadius: "999px",
                                padding: "3px 7px",
                                alignSelf: "flex-end",
                              }}
                            >
                              Done
                            </span>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => handleEdit(activity)}
                            title="Edit entry"
                            aria-label="Edit entry"
                            style={{
                              width: "26px",
                              height: "26px",
                              borderRadius: "9px",
                              border: "1px solid rgba(124, 180, 255, 0.16)",
                              background: "rgba(255, 255, 255, 0.06)",
                              color: "#dbe8fb",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                              fontSize: "12px",
                              alignSelf: "flex-end",
                            }}
                          >
                            ✏️
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default DayPage;