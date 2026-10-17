import React, { useState, useEffect, useMemo } from 'react';
import {
  Bell, Smartphone, ChevronLeft, ChevronRight, CheckCircle2, Circle,
  Download, X, Plus, Calendar, Sprout, Info, Sparkles, Filter, Check
} from 'lucide-react';
import { subscribeToPlantingSchedules, deletePlantingSchedule } from '../firebase';
import { NIGERIA_CROPS, CropDefinition } from '../data/nigeriaCrops';

const phases = [
  { key: 'pre', label: 'Pre-planting', color: '#27500A', bg: '#EAF3DE', desc: 'Soil prep, inputs, land clearing' },
  { key: 'planting', label: 'Planting', color: '#3B6D11', bg: '#D4E8C2', desc: 'Sowing, spacing, first watering' },
  { key: 'post', label: 'Post-planting', color: '#639922', bg: '#EDF5DC', desc: 'Maintenance, pest control, harvest' },
];

export interface ScheduleTask {
  day: number;
  phase: 'pre' | 'planting' | 'post';
  task: string;
  reminder?: boolean;
}

// Generate agronomic tasks tailored to any Nigerian crop, strictly starting from Day 1
export function generateCropTasks(cropName: string, daysToMaturity: number = 90): ScheduleTask[] {
  const maturity = Math.max(60, daysToMaturity);
  const midMaturity = Math.round(maturity * 0.5);
  const preHarvest = Math.max(midMaturity + 10, maturity - 12);

  return [
    { day: 1, phase: 'pre', task: `Day 1: Soil testing & pH verification for ${cropName}`, reminder: true },
    { day: 3, phase: 'pre', task: 'Day 3: Land tillage, ploughing & ridge bed formation', reminder: true },
    { day: 5, phase: 'pre', task: 'Day 5: Apply basal organic manure & NPK basal fertilizer', reminder: false },
    { day: 7, phase: 'pre', task: 'Day 7: Irrigation test run & certified seed inspection', reminder: false },
    { day: 8, phase: 'planting', task: `Day 8: Sow / plant ${cropName} — rows 1–4 (Field A)`, reminder: true },
    { day: 9, phase: 'planting', task: `Day 9: Sow / plant ${cropName} — rows 5–8 (Field A)`, reminder: true },
    { day: 10, phase: 'planting', task: 'Day 10: First watering after planting & moisture check', reminder: false },
    { day: 12, phase: 'planting', task: 'Day 12: Seed germination check & emergence count', reminder: false },
    { day: 15, phase: 'planting', task: 'Day 15: Thinning seedlings to recommended field spacing', reminder: true },
    { day: 18, phase: 'planting', task: 'Day 18: Apply starter foliar spray & root growth booster', reminder: false },
    { day: 22, phase: 'post', task: 'Day 22: First manual weeding & bed aeration between rows', reminder: false },
    { day: 26, phase: 'post', task: 'Day 26: Pest inspection & preventive botanical neem spray', reminder: true },
    { day: 30, phase: 'post', task: 'Day 30: Nitrogen top-dress (Urea / NPK 27:13:13)', reminder: true },
    { day: 38, phase: 'post', task: 'Day 38: Second weeding & root mound earthing-up', reminder: false },
    { day: 45, phase: 'post', task: 'Day 45: Mid-season health assessment & canopy inspection', reminder: true },
    ...(maturity > 70 ? [{ day: midMaturity, phase: 'post' as const, task: `Day ${midMaturity}: Flowering & fruiting stage nutritional boost`, reminder: false }] : []),
    { day: preHarvest, phase: 'post', task: `Day ${preHarvest}: Pre-harvest irrigation dry-down & crate readiness`, reminder: true },
    { day: maturity, phase: 'post', task: `Day ${maturity}: Harvest milestone — reap mature ${cropName} for market delivery`, reminder: true },
  ];
}

interface Props {
  onNavigate?: (s: any) => void;
  profile?: any;
}

export function PlantingCalendar({ onNavigate, profile }: Props) {
  const [allSchedules, setAllSchedules] = useState<any[]>([]);
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Dynamic calendar date: initialized to the real current date!
  const today = useMemo(() => new Date(), []);
  const [viewDate, setViewDate] = useState<Date>(() => new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

  const [activePhaseFilter, setActivePhaseFilter] = useState<string | null>(null);
  const [syncDone, setSyncDone] = useState(false);

  // Task completion state stored per schedule
  const [doneTasksMap, setDoneTasksMap] = useState<Record<string, number[]>>(() => {
    try {
      const saved = localStorage.getItem('farmx_done_tasks');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [remindersMap, setRemindersMap] = useState<Record<string, number[]>>(() => {
    try {
      const saved = localStorage.getItem('farmx_reminders');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Load user schedules from Firestore
  useEffect(() => {
    if (!profile || !profile.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToPlantingSchedules(profile.uid, (schedules) => {
      setAllSchedules(schedules);
      if (schedules.length > 0) {
        setActiveScheduleId(prev => {
          if (prev && schedules.some(s => s.id === prev)) return prev;
          return schedules[0].id;
        });
      } else {
        setActiveScheduleId(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  // Determine current month in season crop recommendation (1 to 12)
  const currentMonth = today.getMonth() + 1;
  const inSeasonCrops = useMemo(() => {
    return NIGERIA_CROPS.filter(c => c.plantingMonths.includes(currentMonth));
  }, [currentMonth]);

  const defaultInSeasonCrop: CropDefinition = inSeasonCrops[0] || NIGERIA_CROPS[0];

  // If no user schedule is saved, create a dynamic default in-season schedule starting from Day 1 on Today
  const effectiveSchedule = useMemo(() => {
    if (activeScheduleId && allSchedules.length > 0) {
      const found = allSchedules.find(s => s.id === activeScheduleId);
      if (found) return found;
    }
    if (allSchedules.length > 0) {
      return allSchedules[0];
    }

    // Default dynamic schedule grounded in the current month & current date
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const totalMonthsAhead = Math.max(1, Math.round(defaultInSeasonCrop.daysToMaturity / 30));
    const harvestIdx = (currentMonth - 1 + totalMonthsAhead) % 12;
    const harvestYear = today.getFullYear() + Math.floor((currentMonth - 1 + totalMonthsAhead) / 12);

    return {
      id: 'default_in_season_schedule',
      cropName: defaultInSeasonCrop.name,
      cropEmoji: defaultInSeasonCrop.emoji,
      harvestMonth: `${monthNames[harvestIdx]} ${harvestYear}`,
      location: profile?.farmState ? `${profile.farmState} Region, Nigeria` : 'Kaduna State, Nigeria',
      field: 'Field A (Main Plot)',
      matchScore: 96,
      daysToMaturity: defaultInSeasonCrop.daysToMaturity,
      startDate: today.toISOString(), // Corresponds to current date!
      startDay: 1, // Schedule starts from Day 1
      isDefault: true,
      inSeason: true,
      currentMonthName: monthNames[currentMonth - 1]
    };
  }, [activeScheduleId, allSchedules, defaultInSeasonCrop, currentMonth, today, profile]);

  // Schedule start date: corresponds to current date (Day 1)
  const scheduleStartDate = useMemo(() => {
    if (effectiveSchedule?.startDate) {
      const d = new Date(effectiveSchedule.startDate);
      if (!isNaN(d.getTime())) return d;
    }
    return today;
  }, [effectiveSchedule, today]);

  // Tasks for the active crop, strictly starting from Day 1
  const cropTasks: ScheduleTask[] = useMemo(() => {
    return generateCropTasks(
      effectiveSchedule.cropName || 'Roma Tomatoes',
      effectiveSchedule.daysToMaturity || 90
    );
  }, [effectiveSchedule]);

  const scheduleKey = effectiveSchedule.id || 'default';
  const doneIndices = doneTasksMap[scheduleKey] || [];
  const reminderIndices = remindersMap[scheduleKey] || [0, 1, 4, 7, 10, 12];

  const toggleDone = (index: number) => {
    setDoneTasksMap(prev => {
      const current = prev[scheduleKey] || [];
      const updated = current.includes(index)
        ? current.filter(i => i !== index)
        : [...current, index];
      const nextMap = { ...prev, [scheduleKey]: updated };
      try { localStorage.setItem('farmx_done_tasks', JSON.stringify(nextMap)); } catch {}
      return nextMap;
    });
  };

  const toggleReminder = (index: number) => {
    setRemindersMap(prev => {
      const current = prev[scheduleKey] || [];
      const updated = current.includes(index)
        ? current.filter(i => i !== index)
        : [...current, index];
      const nextMap = { ...prev, [scheduleKey]: updated };
      try { localStorage.setItem('farmx_reminders', JSON.stringify(nextMap)); } catch {}
      return nextMap;
    });
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!profile) return;
    await deletePlantingSchedule(scheduleId);
    const remaining = allSchedules.filter(s => s.id !== scheduleId);
    setActiveScheduleId(remaining.length > 0 ? remaining[0].id : null);
  };

  // Helper to calculate exact calendar date for any task day
  const getTaskCalendarDate = (taskDay: number) => {
    const d = new Date(scheduleStartDate);
    d.setDate(d.getDate() + (taskDay - 1));
    return d;
  };

  // Month Calendar Grid calculations
  const viewYear = viewDate.getFullYear();
  const viewMonthIndex = viewDate.getMonth();
  const daysInMonth = new Date(viewYear, viewMonthIndex + 1, 0).getDate();
  // Monday-first starting offset (0 = Mon, 6 = Sun)
  const firstDayOfWeek = (new Date(viewYear, viewMonthIndex, 1).getDay() + 6) % 7;

  const viewMonthTitle = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const isCurrentViewMonthToday = viewDate.getFullYear() === today.getFullYear() && viewDate.getMonth() === today.getMonth();

  const handlePrevMonth = () => {
    setViewDate(new Date(viewYear, viewMonthIndex - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewYear, viewMonthIndex + 1, 1));
  };

  const handleJumpToToday = () => {
    setViewDate(new Date());
    setSelectedCalendarDate(today.toDateString());
  };

  // Filter tasks based on active phase and optional selected calendar date
  const filteredTasks = cropTasks.filter(t => {
    if (activePhaseFilter && t.phase !== activePhaseFilter) return false;
    if (selectedCalendarDate) {
      const taskDate = getTaskCalendarDate(t.day);
      if (taskDate.toDateString() !== selectedCalendarDate) return false;
    }
    return true;
  });

  const completedCount = cropTasks.filter((_, idx) => doneIndices.includes(idx)).length;
  const progressPct = Math.round((completedCount / cropTasks.length) * 100);

  // Find tasks scheduled on each calendar day
  const getTasksForDayNumber = (dayNum: number) => {
    const cellDate = new Date(viewYear, viewMonthIndex, dayNum);
    const cellDateString = cellDate.toDateString();
    return cropTasks.filter(t => getTaskCalendarDate(t.day).toDateString() === cellDateString);
  };

  return (
    <div className="p-5 lg:p-6 max-w-5xl mx-auto animate-fade-in" id="planting_calendar_root">
      {/* Schedule selector tabs / header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#27500A]">
              Farmer Planting Calendar
            </h1>
            <span className="bg-emerald-100 text-emerald-800 text-[11px] font-medium px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Sprout size={12} /> Starts from Day 1
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Grounded in current local weather and Nigerian agricultural planting windows.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate?.('crop-prediction')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all text-xs font-medium cursor-pointer shadow-sm hover:scale-[0.99] active:scale-[0.98]"
            style={{ background: '#27500A', color: '#fff' }}
            id="add_new_schedule_btn"
          >
            <Plus size={14} /> AI Crop Diagnostics
          </button>
          <button
            onClick={() => setSyncDone(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all text-xs font-medium border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 cursor-pointer"
          >
            <Smartphone size={13} className="text-[#27500A]" />
            {syncDone ? '✓ Synced to SMS' : 'SMS Reminders'}
          </button>
        </div>
      </div>

      {/* Multiple active crop schedules bar */}
      {allSchedules.length > 0 && (
        <div className="mb-6 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {allSchedules.map(schedule => {
            const isSelected = activeScheduleId === schedule.id;
            return (
              <div
                key={schedule.id}
                onClick={() => setActiveScheduleId(schedule.id)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl cursor-pointer transition-all flex-shrink-0 border"
                style={{
                  background: isSelected ? '#27500A' : '#ffffff',
                  borderColor: isSelected ? '#27500A' : 'rgba(0,0,0,0.1)',
                  color: isSelected ? '#ffffff' : '#374151',
                }}
              >
                <span className="text-lg">{schedule.cropEmoji || '🌱'}</span>
                <div className="text-left">
                  <p className="text-xs font-semibold leading-tight">{schedule.cropName}</p>
                  <p className={`text-[10px] ${isSelected ? 'text-emerald-100' : 'text-gray-400'}`}>
                    Day 1: {new Date(schedule.startDate || schedule.generatedAt || today).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
                {allSchedules.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSchedule(schedule.id);
                    }}
                    className="ml-1 text-gray-400 hover:text-red-500 transition-colors p-0.5"
                    title="Remove schedule"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Active Crop Overview Card */}
      <div className="rounded-2xl p-5 mb-6 bg-gradient-to-r from-emerald-50/90 via-[#F4FAF0] to-emerald-50/40 border border-emerald-200/80 shadow-sm relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center text-3xl shadow-sm border border-emerald-100 shrink-0">
              {effectiveSchedule.cropEmoji || '🌾'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-[#27500A]">
                  {effectiveSchedule.cropName} Planting Schedule
                </h2>
                <span className="bg-emerald-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  Day 1 starts: {scheduleStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-gray-600">
                <span>📍 {effectiveSchedule.location || 'Kaduna Region, Nigeria'}</span>
                <span>🌾 {effectiveSchedule.field || 'Field A'}</span>
                <span>🗓 Target Harvest: <strong className="text-emerald-800">{effectiveSchedule.harvestMonth}</strong></span>
                <span>⏱ Growth Period: {effectiveSchedule.daysToMaturity || 90} days</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            <button
              onClick={() => onNavigate?.('crop-prediction')}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-emerald-700/30 text-[#27500A] bg-white hover:bg-emerald-50 transition-colors cursor-pointer"
            >
              Change Crop / Field
            </button>
          </div>
        </div>

        {/* In-season advisory alert */}
        <div className="mt-4 pt-3 border-t border-emerald-200/60 flex items-center justify-between gap-2 text-xs text-emerald-800">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-emerald-600 shrink-0" />
            <span>
              <strong>Current Month In-Season Match:</strong> {effectiveSchedule.cropName} is recommended for planting right now in Nigerian agro-ecological zones.
            </span>
          </div>
          <span className="text-[11px] text-emerald-700 font-mono hidden md:inline">
            Today is {today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Progress summary block */}
      <div className="rounded-xl p-4 mb-6 border border-emerald-200/70 bg-[#EAF3DE]">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs font-bold text-[#27500A] uppercase tracking-wider">Milestone Progress</p>
            <p className="text-xs text-gray-600">
              {completedCount} of {cropTasks.length} agronomic tasks completed · Day 1 on {scheduleStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          </div>
          <span className="text-2xl font-bold text-[#27500A]">{progressPct}%</span>
        </div>

        <div className="h-2 rounded-full bg-emerald-200 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 bg-[#27500A]"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3">
          {phases.map(p => {
            const phaseTasks = cropTasks.filter(t => t.phase === p.key);
            const done = phaseTasks.filter(t => doneIndices.includes(cropTasks.indexOf(t))).length;
            return (
              <div key={p.key} className="rounded-lg p-2.5 text-center shadow-xs" style={{ background: p.bg }}>
                <p className="text-xs font-bold" style={{ color: p.color }}>{done} / {phaseTasks.length}</p>
                <p className="text-[11px] text-gray-600 font-medium">{p.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Month Calendar Grid */}
      <div className="rounded-2xl overflow-hidden mb-6 border border-gray-200 shadow-sm bg-white">
        {/* Month header & navigation */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#F1EFE8] border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Calendar className="text-[#27500A]" size={16} />
            <span className="text-sm font-semibold text-gray-800">{viewMonthTitle}</span>
            {isCurrentViewMonthToday && (
              <span className="bg-[#27500A] text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                Current Month
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleJumpToToday}
              className="px-2.5 py-1 text-xs font-semibold rounded-md border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 transition cursor-pointer"
            >
              Today ({today.getDate()})
            </button>
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 transition cursor-pointer"
              aria-label="Previous month"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 transition cursor-pointer"
              aria-label="Next month"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 bg-[#F7F6F2] border-b border-gray-100 text-center py-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(dayName => (
            <div key={dayName} className="text-[11px] font-semibold text-gray-600">
              {dayName}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-gray-100 bg-white">
          {/* Leading blank cells */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`blank-${i}`} className="min-h-[72px] sm:min-h-[82px] bg-gray-50/50 p-1" />
          ))}

          {/* Month days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const cellDate = new Date(viewYear, viewMonthIndex, dayNum);
            const cellDateStr = cellDate.toDateString();
            const isTodayCell = cellDateStr === today.toDateString();
            const isSelected = selectedCalendarDate === cellDateStr;
            const dayTasks = getTasksForDayNumber(dayNum);

            return (
              <div
                key={`day-${dayNum}`}
                onClick={() => {
                  setSelectedCalendarDate(prev => prev === cellDateStr ? null : cellDateStr);
                }}
                className={`min-h-[72px] sm:min-h-[82px] p-1.5 flex flex-col justify-between transition-all cursor-pointer hover:bg-emerald-50/40 ${
                  isTodayCell ? 'bg-emerald-50/80 font-bold' : isSelected ? 'bg-emerald-100/60 ring-2 ring-[#27500A]' : 'bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-colors ${
                      isTodayCell
                        ? 'bg-[#27500A] text-white font-bold shadow-xs'
                        : isSelected
                        ? 'bg-emerald-800 text-white font-bold'
                        : 'text-gray-700'
                    }`}
                  >
                    {dayNum}
                  </span>

                  {isTodayCell && (
                    <span className="text-[9px] font-bold text-[#27500A] uppercase tracking-wider hidden sm:inline">
                      Today
                    </span>
                  )}
                  {dayTasks.length > 0 && !isTodayCell && (
                    <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
                  )}
                </div>

                {/* Day tasks badges */}
                <div className="space-y-1 overflow-hidden">
                  {dayTasks.slice(0, 2).map((t) => {
                    const originalIdx = cropTasks.indexOf(t);
                    const isDone = doneIndices.includes(originalIdx);
                    const phaseInfo = phases.find(p => p.key === t.phase);
                    return (
                      <div
                        key={t.day}
                        className="rounded px-1 py-0.5 text-[9px] sm:text-[10px] leading-tight truncate border"
                        style={{
                          background: isDone ? '#E5E7EB' : phaseInfo?.bg || '#EAF3DE',
                          color: isDone ? '#6B7280' : phaseInfo?.color || '#27500A',
                          borderColor: isDone ? '#D1D5DB' : 'rgba(39,80,10,0.2)',
                          textDecoration: isDone ? 'line-through' : 'none',
                        }}
                      >
                        <span className="font-semibold">Day {t.day}:</span> {t.task.replace(/^Day \d+:\s*/, '')}
                      </div>
                    );
                  })}
                  {dayTasks.length > 2 && (
                    <p className="text-[9px] text-gray-500 font-semibold pl-1">
                      +{dayTasks.length - 2} more
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Phase filter pill bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActivePhaseFilter(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              activePhaseFilter === null
                ? 'bg-[#27500A] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Phases ({cropTasks.length})
          </button>
          {phases.map(p => {
            const count = cropTasks.filter(t => t.phase === p.key).length;
            const isActive = activePhaseFilter === p.key;
            return (
              <button
                key={p.key}
                onClick={() => setActivePhaseFilter(isActive ? null : p.key)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer border flex items-center gap-1.5"
                style={{
                  background: isActive ? p.color : p.bg,
                  color: isActive ? '#ffffff' : p.color,
                  borderColor: p.color,
                }}
              >
                <span>{p.label}</span>
                <span className="opacity-80">({count})</span>
              </button>
            );
          })}
        </div>

        {selectedCalendarDate && (
          <button
            onClick={() => setSelectedCalendarDate(null)}
            className="text-xs text-[#27500A] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <X size={12} /> Clear day filter ({selectedCalendarDate})
          </button>
        )}
      </div>

      {/* Task list starting strictly from Day 1 with exact calendar dates */}
      <div className="rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-xs">
        <div className="px-4 py-3 bg-[#F1EFE8] border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs sm:text-sm font-semibold text-gray-800">
              Agronomic Task Schedule · Starts Day 1
            </h2>
            <span className="text-[11px] text-gray-500">
              ({filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'} shown)
            </span>
          </div>
          <span className="text-xs text-emerald-800 font-medium">
            {doneIndices.length} completed
          </span>
        </div>

        <div className="divide-y divide-gray-100">
          {filteredTasks.map((t) => {
            const originalIndex = cropTasks.indexOf(t);
            const isDone = doneIndices.includes(originalIndex);
            const hasReminder = reminderIndices.includes(originalIndex);
            const phaseInfo = phases.find(p => p.key === t.phase)!;
            const taskCalDate = getTaskCalendarDate(t.day);
            const isTaskToday = taskCalDate.toDateString() === today.toDateString();

            return (
              <div
                key={t.day}
                className={`flex items-start gap-3 p-4 transition-colors ${
                  isTaskToday ? 'bg-emerald-50/70' : isDone ? 'bg-gray-50/60' : 'bg-white'
                }`}
              >
                {/* Complete checkbox */}
                <button
                  type="button"
                  onClick={() => toggleDone(originalIndex)}
                  className="mt-0.5 cursor-pointer focus:outline-hidden"
                  aria-label={isDone ? 'Mark incomplete' : 'Mark complete'}
                >
                  {isDone ? (
                    <CheckCircle2 size={18} className="text-[#27500A]" />
                  ) : (
                    <Circle size={18} className="text-gray-300 hover:text-emerald-600 transition-colors" />
                  )}
                </button>

                {/* Task content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {/* Day badge */}
                    <span className="font-mono text-xs font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
                      Day {t.day}
                    </span>

                    {/* Phase badge */}
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: phaseInfo.bg, color: phaseInfo.color }}
                    >
                      {phaseInfo.label}
                    </span>

                    {/* Exact calendar date */}
                    <span className="text-xs text-gray-500 font-medium">
                      📅 {taskCalDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>

                    {isTaskToday && (
                      <span className="bg-[#27500A] text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                        Today (Day {t.day})
                      </span>
                    )}
                  </div>

                  <p className={`text-sm ${isDone ? 'text-gray-400 line-through' : 'text-gray-800 font-medium'}`}>
                    {t.task}
                  </p>
                </div>

                {/* Reminder toggle */}
                <button
                  type="button"
                  onClick={() => toggleReminder(originalIndex)}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    hasReminder ? 'bg-emerald-100 text-[#27500A]' : 'text-gray-400 hover:bg-gray-100'
                  }`}
                  title={hasReminder ? 'Reminder active' : 'Turn reminder on'}
                >
                  <Bell size={16} />
                </button>
              </div>
            );
          })}

          {filteredTasks.length === 0 && (
            <div className="py-12 text-center text-gray-500 text-xs">
              No tasks found matching your filter criteria.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
