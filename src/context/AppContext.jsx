import React, { createContext, useEffect, useMemo, useState } from "react";

export const AppContext = createContext();

const ISRAEL_TIMEZONE = "Asia/Jerusalem";
const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const createDayMetrics = () => ({
  calories: "",
  caloriesGoal: "2500",
  waterAmount: "",
  waterGoal: "3",
  waterUnit: "ml",
  waterGoalUnit: "l",
  sleepHours: "",
  sleepGoal: "8",
});

const getIsraelTodayDateKey = () => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: ISRAEL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  return `${year}-${month}-${day}`;
};

const dateKeyToUTCDate = (dateKey) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
};

const addDaysToDateKey = (dateKey, amount) => {
  const date = dateKeyToUTCDate(dateKey);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
};

const getStartOfWeekDateKey = (dateKey) => {
  const date = dateKeyToUTCDate(dateKey);
  const dayOfWeek = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - dayOfWeek);
  return date.toISOString().slice(0, 10);
};

const formatShortDate = (dateKey) => {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(dateKeyToUTCDate(dateKey));
};

const formatLongDate = (dateKey) => {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(dateKeyToUTCDate(dateKey));
};

const waterToLiters = (amount, unit) => {
  const num = parseFloat(amount);
  if (Number.isNaN(num)) return 0;
  return unit === "ml" ? num / 1000 : num;
};

const isWaterGoalHit = (stats) => {
  const current = waterToLiters(stats.waterAmount, stats.waterUnit);
  const goal = waterToLiters(stats.waterGoal, stats.waterGoalUnit);
  return goal > 0 && current >= goal;
};

const isSleepGoalHit = (stats) => {
  const current = parseFloat(stats.sleepHours);
  const goal = parseFloat(stats.sleepGoal);
  if (Number.isNaN(current) || Number.isNaN(goal) || goal <= 0) return false;
  return current >= goal;
};

const isCaloriesGoalHit = (stats) => {
  const current = parseFloat(stats.calories);
  const goal = parseFloat(stats.caloriesGoal);
  if (Number.isNaN(current) || Number.isNaN(goal) || goal <= 0) return false;
  return current <= goal;
};

const computeStreak = (statsByDate, todayDateKey, goalChecker) => {
  let streak = 0;
  let cursor = todayDateKey;

  while (true) {
    const stats = statsByDate[cursor];
    if (!stats || !goalChecker(stats)) break;
    streak += 1;
    cursor = addDaysToDateKey(cursor, -1);
  }

  return streak;
};

export const AppProvider = ({ children }) => {
  const [activitiesByDate, setActivitiesByDate] = useState(() => {
    const saved = localStorage.getItem("planGridActivitiesByDate");
    return saved ? JSON.parse(saved) : {};
  });

  const [statsByDate, setStatsByDate] = useState(() => {
    const saved = localStorage.getItem("planGridStatsByDate");
    return saved ? JSON.parse(saved) : {};
  });

  const [weekOffset, setWeekOffset] = useState(0);

  const todayDateKey = getIsraelTodayDateKey();

  const currentWeek = useMemo(() => {
    const startOfWeek = addDaysToDateKey(
      getStartOfWeekDateKey(todayDateKey),
      weekOffset * 7
    );

    return DAYS.map((dayName, index) => {
      const dateKey = addDaysToDateKey(startOfWeek, index);
      return {
        dayName,
        dateKey,
        shortDate: formatShortDate(dateKey),
        longDate: formatLongDate(dateKey),
        isToday: dateKey === todayDateKey,
      };
    });
  }, [todayDateKey, weekOffset]);

  const currentWeekLabel = useMemo(() => {
    const first = currentWeek[0];
    const last = currentWeek[currentWeek.length - 1];
    return `${first.shortDate} - ${last.shortDate}`;
  }, [currentWeek]);

  const streaks = useMemo(() => {
    return {
      water: computeStreak(statsByDate, todayDateKey, isWaterGoalHit),
      sleep: computeStreak(statsByDate, todayDateKey, isSleepGoalHit),
      calories: computeStreak(statsByDate, todayDateKey, isCaloriesGoalHit),
    };
  }, [statsByDate, todayDateKey]);

  useEffect(() => {
    localStorage.setItem(
      "planGridActivitiesByDate",
      JSON.stringify(activitiesByDate)
    );
  }, [activitiesByDate]);

  useEffect(() => {
    localStorage.setItem("planGridStatsByDate", JSON.stringify(statsByDate));
  }, [statsByDate]);

  const getDateKeyForDay = (dayName) => {
    return currentWeek.find((d) => d.dayName === dayName)?.dateKey || todayDateKey;
  };

  const getStatsForDate = (dateKey) => {
    return statsByDate[dateKey] || createDayMetrics();
  };

  const getActivitiesForDate = (dateKey) => {
    return activitiesByDate[dateKey] || [];
  };

  const addActivity = (dateKey, activity) => {
    const newActivity = {
      ...activity,
      id: Date.now() + Math.random(),
      completed: false,
    };

    setActivitiesByDate((prev) => ({
      ...prev,
      [dateKey]: [...(prev[dateKey] || []), newActivity],
    }));
  };

  const updateActivity = (dateKey, updatedActivity) => {
    setActivitiesByDate((prev) => ({
      ...prev,
      [dateKey]: (prev[dateKey] || []).map((activity) =>
        activity.id === updatedActivity.id
          ? {
              ...activity,
              ...updatedActivity,
              completed:
                typeof updatedActivity.completed === "boolean"
                  ? updatedActivity.completed
                  : !!activity.completed,
            }
          : activity
      ),
    }));
  };

  const toggleActivityCompleted = (dateKey, activityId) => {
    setActivitiesByDate((prev) => ({
      ...prev,
      [dateKey]: (prev[dateKey] || []).map((activity) =>
        activity.id === activityId
          ? {
              ...activity,
              completed: !activity.completed,
            }
          : activity
      ),
    }));
  };

  const deleteActivity = (dateKey, activityId) => {
    setActivitiesByDate((prev) => ({
      ...prev,
      [dateKey]: (prev[dateKey] || []).filter((a) => a.id !== activityId),
    }));
  };

  const reorderActivities = (dateKey, newList) => {
    setActivitiesByDate((prev) => ({
      ...prev,
      [dateKey]: newList,
    }));
  };

  const updateDayStats = (dateKey, newStats) => {
    setStatsByDate((prev) => ({
      ...prev,
      [dateKey]: {
        ...(prev[dateKey] || createDayMetrics()),
        ...newStats,
      },
    }));
  };

  const goToPreviousWeek = () => setWeekOffset((prev) => prev - 1);
  const goToNextWeek = () => setWeekOffset((prev) => prev + 1);
  const goToCurrentWeek = () => setWeekOffset(0);

  return (
    <AppContext.Provider
      value={{
        days: DAYS,
        todayDateKey,
        currentWeek,
        currentWeekLabel,
        weekOffset,
        goToPreviousWeek,
        goToNextWeek,
        goToCurrentWeek,
        getDateKeyForDay,
        getStatsForDate,
        getActivitiesForDate,
        addActivity,
        updateActivity,
        toggleActivityCompleted,
        deleteActivity,
        reorderActivities,
        updateDayStats,
        streaks,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};