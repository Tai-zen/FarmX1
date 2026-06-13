import React, { useState } from 'react';
import { Bell, Smartphone, ChevronLeft, ChevronRight, CheckCircle2, Circle, Download, X, Plus } from 'lucide-react';

const phases = [
  { key: 'pre', label: 'Pre-planting', color: '#27500A', bg: '#EAF3DE', desc: 'Soil prep, inputs, land clearing' },
  { key: 'planting', label: 'Planting', color: '#3B6D11', bg: '#D4E8C2', desc: 'Sowing, spacing, first watering' },
  { key: 'post', label: 'Post-planting', color: '#639922', bg: '#EDF5DC', desc: 'Maintenance, pest control, harvest' },
];

const allTasks = [
  { day: 1, phase: 'pre', task: 'Soil testing — all field sections', done: true, reminder: true },
  { day: 3, phase: 'pre', task: 'Apply basal fertiliser (NPK 15:15:15)', done: true, reminder: true },
  { day: 5, phase: 'pre', task: 'Irrigation system setup & test run', done: true, reminder: false },
  { day: 7, phase: 'pre', task: 'Land clearing & ridge preparation', done: true, reminder: false },
  { day: 8, phase: 'planting', task: 'Sow seeds — rows 1–4 (Field A)', done: false, reminder: true },
  { day: 9, phase: 'planting', task: 'Sow seeds — rows 5–8 (Field A)', done: false, reminder: true },
  { day: 10, phase: 'planting', task: 'First watering after sowing', done: false, reminder: false },
  { day: 11, phase: 'planting', task: 'Apply germination stimulant', done: false, reminder: false },
  { day: 12, phase: 'planting', task: 'Mark germination date & count', done: false, reminder: true },
  { day: 15, phase: 'planting', task: 'Thinning seedlings to 30cm spacing', done: false, reminder: true },
  { day: 17, phase: 'planting', task: 'Apply starter fertiliser (foliar spray)', done: false, reminder: false },
  { day: 20, phase: 'post', task: 'First weeding — rows 1–8', done: false, reminder: false },
  { day: 22, phase: 'post', task: 'Fertiliser top-dress (Urea application)', done: false, reminder: true },
  { day: 24, phase: 'post', task: 'Pest inspection & neem spray', done: false, reminder: true },
  { day: 26, phase: 'post', task: 'Staking support structures (if needed)', done: false, reminder: false },
  { day: 28, phase: 'post', task: 'Progress photo record for farm log', done: false, reminder: false },
  { day: 30, phase: 'post', task: 'End-of-month farm health assessment', done: false, reminder: true },
];

interface Props {
  onNavigate?: (s: any) => void;
  profile?: any;
}

export function PlantingCalendar({ onNavigate, profile }: Props) {
  const [doneTasks, setDoneTasks] = useState<Set<number>>(new Set([0, 1, 2, 3]));
  const [reminders, setReminders] = useState<Set<number>>(new Set([0, 1, 4, 5, 8, 9, 11, 13, 16]));
  const [syncDone, setSyncDone] = useState(false);
  const [activePhaseFilter, setActivePhaseFilter] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState('June 2026');
  const [allSchedules, setAllSchedules] = useState<any[]>([]);
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    setLoading(true);

    if (!profile) {
      setLoading(false);
      return;
    }

    if (!profile.uid) {
      console.warn('[PlantingCalendar] profile.uid is missing — schedules cannot be loaded reliably.');
      setLoading(false);
      return;
    }

    // Load all schedules from multi-schedule key
    const schedulesKey = `crop_schedules_${profile.uid}`;
    const schedulesJson = localStorage.getItem(schedulesKey);
    if (schedulesJson) {
      try {
        const schedules = JSON.parse(schedulesJson);
        setAllSchedules(schedules);

        // Try to set active schedule to the one marked as active, or first one
        const activeIdKey = `farmx_active_schedule_${profile.uid}`;
        const activeId = localStorage.getItem(activeIdKey);
        if (activeId && schedules.some((s: any) => s.id === activeId)) {
          setActiveScheduleId(activeId);
        } else if (schedules.length > 0) {
          setActiveScheduleId(schedules[0].id);
        }
      } catch (e) {
        console.error('Failed to parse schedules:', e);
      }
    }

    setLoading(false);
  }, [profile]);

  const isNewUser = profile && !profile.isDemo && allSchedules.length === 0 && !loading;

  if (isNewUser) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center py-20">
        <div className="w-16 h-16 rounded-full bg-[#EAF3DE] text-[#27500A] flex items-center justify-center mx-auto mb-5 text-2xl">
          📅
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 500, color: '#27500A', marginBottom: 8 }} id="new-user-calendar-header">Your planting calendar</h1>
        <p style={{ fontSize: 13, color: '#5F5E5A', marginBottom: 24, lineHeight: 1.6 }} className="max-w-md mx-auto sans">
          You don't have any crop schedules yet. Walk through the **Crop AI** diagnostics to scan soil metrics and generate a planting timeline for your crops.
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={() => onNavigate?.('crop-prediction')}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-white transition hover:scale-[0.99] active:scale-[0.98] cursor-pointer shadow-sm text-xs"
            style={{ backgroundColor: '#27500A' }}
            id="launch-crop-ai-btn"
          >
            <Plus size={14} /> Generate First Schedule
          </button>
        </div>
      </div>
    );
  }

  // Get active schedule
  const activeSchedule = allSchedules.find(s => s.id === activeScheduleId) || allSchedules[0];
  
  const handleDeleteSchedule = (scheduleId: string) => {
    if (!profile) return;
    
    const updatedSchedules = allSchedules.filter(s => s.id !== scheduleId);
    const schedulesKey = `crop_schedules_${profile.uid}`;
    
    if (updatedSchedules.length > 0) {
      localStorage.setItem(schedulesKey, JSON.stringify(updatedSchedules));
      setAllSchedules(updatedSchedules);
      
      // Switch to first remaining schedule
      setActiveScheduleId(updatedSchedules[0].id);
      localStorage.setItem(`farmx_active_schedule_${profile.uid}`, updatedSchedules[0].id);
    } else {
      // No schedules left
      localStorage.removeItem(schedulesKey);
      localStorage.removeItem(`farmx_active_schedule_${profile.uid}`);
      setAllSchedules([]);
      setActiveScheduleId(null);
    }
  };
  
  const handleSwitchSchedule = (scheduleId: string) => {
    setActiveScheduleId(scheduleId);
    if (profile) {
      localStorage.setItem(`farmx_active_schedule_${profile.uid}`, scheduleId);
    }
  };

  // For active schedules, show multiple crop management
  if (activeSchedule && allSchedules.length > 0) {
    const toggleDone = (i: number) => setDoneTasks(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
    const toggleReminder = (i: number) => setReminders(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });

    const filteredTasks = activePhaseFilter ? allTasks.filter(t => t.phase === activePhaseFilter) : allTasks;
    const completedCount = allTasks.filter((_, i) => doneTasks.has(i)).length;
    const progressPct = Math.round((completedCount / allTasks.length) * 100);

    return (
      <div className="p-5 lg:p-6 max-w-5xl mx-auto">
        {/* Schedule selector tabs */}
        {allSchedules.length > 1 && (
          <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
            {allSchedules.map(schedule => (
              <div key={schedule.id}
                onClick={() => handleSwitchSchedule(schedule.id)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-all flex-shrink-0"
                style={{
                  background: activeScheduleId === schedule.id ? '#27500A' : '#F1EFE8',
                  border: activeScheduleId === schedule.id ? 'none' : '0.5px solid rgba(0,0,0,0.1)',
                }}>
                <span style={{ fontSize: 18 }}>{schedule.cropEmoji}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: activeScheduleId === schedule.id ? '#fff' : '#444441' }}>
                  {schedule.cropName}
                </span>
                {activeScheduleId === schedule.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSchedule(schedule.id);
                    }}
                    className="ml-1 hover:opacity-70 transition-opacity"
                    style={{ appearance: 'none', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                    <X size={14} style={{ color: '#fff' }} />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => onNavigate?.('crop-prediction')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all flex-shrink-0"
              style={{ border: '0.5px dashed #27500A', fontSize: 12, color: '#27500A', background: '#fff', cursor: 'pointer' }}>
              <Plus size={14} /> Add Schedule
            </button>
          </div>
        )}

        {/* Active crop card */}
        <div className="rounded-xl p-6 mb-6 bg-emerald-50 border border-emerald-200">
          <div className="flex items-start gap-4 mb-4">
            <span style={{ fontSize: 48 }}>{activeSchedule.cropEmoji}</span>
            <div className="flex-1">
              <h1 style={{ fontSize: 24, fontWeight: 600, color: '#27500A', marginBottom: 8 }}>Growing {activeSchedule.cropName}</h1>
              <div className="space-y-2" style={{ fontSize: 13, color: '#5F5E5A' }}>
                <p><span style={{ fontWeight: 500, color: '#444441' }}>📍 Location:</span> {activeSchedule.location}</p>
                <p><span style={{ fontWeight: 500, color: '#444441' }}>🌾 Field:</span> {activeSchedule.field}</p>
                <p><span style={{ fontWeight: 500, color: '#444441' }}>📅 Harvest:</span> {activeSchedule.harvestMonth}</p>
                <p><span style={{ fontWeight: 500, color: '#444441' }}>✓ Suitability:</span> {activeSchedule.matchScore}% match</p>
              </div>
            </div>
            {allSchedules.length === 1 && (
              <button
                onClick={() => handleDeleteSchedule(activeSchedule.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: '#fff', border: '0.5px solid #E74C3C', color: '#E74C3C', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                Delete Schedule
              </button>
            )}
          </div>
        </div>

        {/* Calendar with tasks */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 500, color: '#27500A' }}>Planting timeline</h2>
            <p style={{ fontSize: 13, color: '#5F5E5A' }}>Tasks and milestones for {activeSchedule.cropName}</p>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg"
              style={{ border: '0.5px solid rgba(0,0,0,0.12)', fontSize: 12, color: '#5F5E5A', background: '#fff' }}
              aria-label="Download calendar">
              <Download size={13} /> Export
            </button>
            <button onClick={() => setSyncDone(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all"
              style={{ background: syncDone ? '#EAF3DE' : '#27500A', color: syncDone ? '#27500A' : '#fff', fontSize: 12, border: syncDone ? '0.5px solid #3B6D11' : 'none' }}>
              <Smartphone size={13} />
              {syncDone ? '✓ Synced' : 'Sync to phone'}
            </button>
          </div>
        </div>

        {/* Progress summary */}
        <div className="rounded-xl p-4 mb-5" style={{ border: '0.5px solid rgba(0,0,0,0.1)', background: '#EAF3DE' }}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#27500A' }}>Overall progress</p>
              <p style={{ fontSize: 11, color: '#5F5E5A' }}>{completedCount} of {allTasks.length} tasks completed</p>
            </div>
            <span style={{ fontSize: 24, fontWeight: 500, color: '#27500A' }}>{progressPct}%</span>
          </div>
          <div className="h-2 rounded-full" style={{ background: '#D4E8C2' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${progressPct}%`, background: '#27500A' }} />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {phases.map(p => {
              const phaseTasks = allTasks.filter(t => t.phase === p.key);
              const done = phaseTasks.filter((t, i) => doneTasks.has(allTasks.indexOf(t))).length;
              return (
                <div key={p.key} className="rounded-lg p-2.5 text-center" style={{ background: p.bg }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: p.color }}>{done}/{phaseTasks.length}</p>
                  <p style={{ fontSize: 10, color: '#5F5E5A' }}>{p.label}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Phase legend + filter */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={() => setActivePhaseFilter(null)}
            className="px-3 py-1.5 rounded-lg transition-all"
            style={{ fontSize: 12, fontWeight: activePhaseFilter === null ? 500 : 400, background: activePhaseFilter === null ? '#27500A' : '#F1EFE8', color: activePhaseFilter === null ? '#fff' : '#5F5E5A', border: activePhaseFilter === null ? 'none' : '0.5px solid rgba(0,0,0,0.1)' }}>
            All phases
          </button>
          {phases.map(p => (
            <button key={p.key} onClick={() => setActivePhaseFilter(p.key)}
              className="px-3 py-1.5 rounded-lg transition-all"
              style={{ fontSize: 12, fontWeight: activePhaseFilter === p.key ? 500 : 400, background: activePhaseFilter === p.key ? p.bg : '#F1EFE8', color: activePhaseFilter === p.key ? p.color : '#5F5E5A', border: activePhaseFilter === p.key ? `1px solid ${p.color}` : '0.5px solid rgba(0,0,0,0.1)' }}>
              {p.label} ({allTasks.filter(t => t.phase === p.key).length})
            </button>
          ))}
        </div>

        {/* Tasks list */}
        <div className="space-y-2">
          {filteredTasks.map((task, i) => {
            const taskIdx = allTasks.indexOf(task);
            const done = doneTasks.has(taskIdx);
            const p = phases.find(ph => ph.key === task.phase)!;
            return (
              <div key={taskIdx} className="rounded-lg p-3 flex items-start gap-3" style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)' }}>
                <button onClick={() => toggleDone(taskIdx)} className="mt-0.5 flex-shrink-0 cursor-pointer"
                  style={{ appearance: 'none', width: 18, height: 18, border: `2px solid ${p.color}`, borderRadius: 4, background: done ? p.color : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {done && <span style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>✓</span>}
                </button>
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: 13, color: done ? '#AAAAA5' : '#444441', textDecoration: done ? 'line-through' : 'none', fontWeight: 500 }}>{task.task}</p>
                  <p style={{ fontSize: 11, color: '#5F5E5A', marginTop: 2 }}>📅 Day {task.day} · {p.label}</p>
                </div>
                <button onClick={() => toggleReminder(taskIdx)} className="flex-shrink-0 cursor-pointer"
                  style={{ appearance: 'none', background: 'none', border: 'none', padding: 0 }}>
                  <Bell size={16} style={{ color: reminders.has(taskIdx) ? '#27500A' : '#AAAAA5' }} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const toggleDone = (i: number) => setDoneTasks(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const toggleReminder = (i: number) => setReminders(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });

  const getPhaseForDay = (d: number) => { if (d <= 7) return 'pre'; if (d <= 19) return 'planting'; return 'post'; };
  const getTaskForDay = (d: number) => allTasks.find((_, i) => allTasks[i].day === d);
  const filteredTasks = activePhaseFilter ? allTasks.filter(t => t.phase === activePhaseFilter) : allTasks;
  const completedCount = allTasks.filter((_, i) => doneTasks.has(i)).length;
  const progressPct = Math.round((completedCount / allTasks.length) * 100);

  return (
    <div className="p-5 lg:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, color: '#27500A' }}>Planting calendar</h1>
          <p style={{ fontSize: 13, color: '#5F5E5A' }}>
            Roma Tomatoes · Field A · Danjuma Farm, Kaduna
          </p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg"
            style={{ border: '0.5px solid rgba(0,0,0,0.12)', fontSize: 12, color: '#5F5E5A', background: '#fff' }}
            aria-label="Download calendar">
            <Download size={13} /> Export
          </button>
          <button onClick={() => setSyncDone(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all"
            style={{ background: syncDone ? '#EAF3DE' : '#27500A', color: syncDone ? '#27500A' : '#fff', fontSize: 12, border: syncDone ? '0.5px solid #3B6D11' : 'none' }}>
            <Smartphone size={13} />
            {syncDone ? '✓ Synced' : 'Sync to phone'}
          </button>
        </div>
      </div>

      {/* Progress summary */}
      <div className="rounded-xl p-4 mb-5" style={{ border: '0.5px solid rgba(0,0,0,0.1)', background: '#EAF3DE' }}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: '#27500A' }}>Overall progress</p>
            <p style={{ fontSize: 11, color: '#5F5E5A' }}>{completedCount} of {allTasks.length} tasks completed · Week 6 of 14</p>
          </div>
          <span style={{ fontSize: 24, fontWeight: 500, color: '#27500A' }}>{progressPct}%</span>
        </div>
        <div className="h-2 rounded-full" style={{ background: '#D4E8C2' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${progressPct}%`, background: '#27500A' }} />
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          {phases.map(p => {
            const phaseTasks = allTasks.filter(t => t.phase === p.key);
            const done = phaseTasks.filter((t, i) => doneTasks.has(allTasks.indexOf(t))).length;
            return (
              <div key={p.key} className="rounded-lg p-2.5 text-center" style={{ background: p.bg }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: p.color }}>{done}/{phaseTasks.length}</p>
                <p style={{ fontSize: 10, color: '#5F5E5A' }}>{p.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Phase legend + filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setActivePhaseFilter(null)}
          className="px-3 py-1.5 rounded-full"
          style={{ fontSize: 11, background: !activePhaseFilter ? '#444441' : '#F1EFE8', color: !activePhaseFilter ? '#fff' : '#5F5E5A' }}>
          All phases
        </button>
        {phases.map(p => (
          <button key={p.key} onClick={() => setActivePhaseFilter(activePhaseFilter === p.key ? null : p.key)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{ fontSize: 11, background: activePhaseFilter === p.key ? p.color : p.bg, color: activePhaseFilter === p.key ? '#fff' : p.color, border: `0.5px solid ${p.color}` }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: activePhaseFilter === p.key ? '#fff' : p.color }} />
            {p.label}
          </button>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl overflow-hidden mb-5" style={{ border: '0.5px solid rgba(0,0,0,0.12)' }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ background: '#F1EFE8', borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>
          <button className="p-1.5 rounded-lg" style={{ border: '0.5px solid rgba(0,0,0,0.12)' }} aria-label="Previous month">
            <ChevronLeft size={13} style={{ color: '#5F5E5A' }} />
          </button>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#444441' }}>{viewMonth}</span>
          <button className="p-1.5 rounded-lg" style={{ border: '0.5px solid rgba(0,0,0,0.12)' }} aria-label="Next month">
            <ChevronRight size={13} style={{ color: '#5F5E5A' }} />
          </button>
        </div>
        <div className="grid grid-cols-7" style={{ background: '#F7F6F2' }}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
            <div key={d} className="text-center py-2" style={{ fontSize: 10, color: '#5F5E5A', fontWeight: 500 }}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: 30 }).map((_, i) => {
            const day = i + 1;
            const phase = getPhaseForDay(day);
            const phaseData = phases.find(p => p.key === phase)!;
            const taskIdx = allTasks.findIndex(t => t.day === day);
            const task = allTasks[taskIdx];
            const done = taskIdx >= 0 && doneTasks.has(taskIdx);
            const isToday = day === 5;
            return (
              <div key={day} className="min-h-[68px] p-1.5"
                style={{ border: '0.5px solid rgba(0,0,0,0.05)', background: isToday ? '#EAF3DE' : '#fff' }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ fontSize: 10, background: isToday ? '#27500A' : 'transparent', color: isToday ? '#fff' : '#5F5E5A' }}>
                    {day}
                  </span>
                  {task && <div className="w-1.5 h-1.5 rounded-full" style={{ background: phaseData.color }} aria-hidden="true" />}
                </div>
                {task && (
                  <p style={{
                    fontSize: 8.5, color: done ? '#aaa' : phaseData.color,
                    textDecoration: done ? 'line-through' : 'none', lineHeight: 1.3, fontWeight: done ? 400 : 500
                  }}>
                    {task.task.length > 28 ? task.task.slice(0, 28) + '…' : task.task}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Task list */}
      <div className="rounded-xl overflow-hidden" style={{ border: '0.5px solid rgba(0,0,0,0.12)' }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#F1EFE8', borderBottom: '0.5px solid rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: 13, fontWeight: 500, color: '#444441' }}>Task list · {filteredTasks.length} tasks</h2>
          <span style={{ fontSize: 11, color: '#5F5E5A' }}>{reminders.size} reminders set</span>
        </div>
        {filteredTasks.map((t, listIdx) => {
          const globalIdx = allTasks.indexOf(t);
          const done = doneTasks.has(globalIdx);
          const hasReminder = reminders.has(globalIdx);
          const phaseData = phases.find(p => p.key === t.phase)!;
          const isToday = t.day === 5;
          return (
            <div key={listIdx}
              className="flex items-center gap-3 px-4 py-3"
              style={{ background: isToday ? '#FAFDF5' : '#fff', borderBottom: listIdx < filteredTasks.length - 1 ? '0.5px solid rgba(0,0,0,0.06)' : 'none' }}>
              <button onClick={() => toggleDone(globalIdx)} aria-label={done ? 'Mark incomplete' : 'Mark complete'}>
                {done ? <CheckCircle2 size={16} style={{ color: '#27500A' }} /> : <Circle size={16} style={{ color: '#D4E8C2' }} />}
              </button>
              <div className="flex-1">
                <p style={{ fontSize: 13, color: done ? '#aaa' : '#444441', textDecoration: done ? 'line-through' : 'none' }}>{t.task}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="rounded-full px-2 py-0.5" style={{ fontSize: 9, background: phaseData.bg, color: phaseData.color }}>{phaseData.label}</span>
                  <span style={{ fontSize: 10, color: isToday ? '#854F0B' : '#5F5E5A' }}>Day {t.day}{isToday ? ' · Today' : ''}</span>
                </div>
              </div>
              <button onClick={() => toggleReminder(globalIdx)}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg transition-all"
                style={{ background: hasReminder ? '#EAF3DE' : '#F1EFE8', border: `0.5px solid ${hasReminder ? '#3B6D11' : 'rgba(0,0,0,0.1)'}` }}
                aria-label={hasReminder ? 'Disable reminder' : 'Enable reminder'}>
                <Bell size={11} style={{ color: hasReminder ? '#27500A' : '#5F5E5A' }} />
                <span style={{ fontSize: 9, color: hasReminder ? '#27500A' : '#5F5E5A' }}>{hasReminder ? 'On' : 'Off'}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
