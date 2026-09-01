import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';

interface InteractiveCalendarProps {
  selectedDate: string; // 'YYYY-MM-DD'
  onSelectDate: (dateStr: string) => void;
  onClose?: () => void;
  appointmentsCountByDate?: Record<string, number>;
  inline?: boolean;
}

export const InteractiveCalendar: React.FC<InteractiveCalendarProps> = ({
  selectedDate,
  onSelectDate,
  onClose,
  appointmentsCountByDate = {},
  inline = false,
}) => {
  // Parse initial selected date to set current viewing month/year
  const getInitialView = () => {
    try {
      if (selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
        const [y, m] = selectedDate.split('-').map(Number);
        return { year: y, month: m - 1 }; // month 0-indexed
      }
    } catch {
      // fallback
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  };

  const [viewDate, setViewDate] = useState(getInitialView);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync view when selectedDate changes from outside
  useEffect(() => {
    if (selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      const [y, m] = selectedDate.split('-').map(Number);
      setViewDate({ year: y, month: m - 1 });
    }
  }, [selectedDate]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose?.();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const weekDayHeaders = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  // Navigate months
  const prevMonth = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setViewDate(curr => {
      if (curr.month === 0) {
        return { year: curr.year - 1, month: 11 };
      }
      return { year: curr.year, month: curr.month - 1 };
    });
  };

  const nextMonth = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setViewDate(curr => {
      if (curr.month === 11) {
        return { year: curr.year + 1, month: 0 };
      }
      return { year: curr.year, month: curr.month + 1 };
    });
  };

  const goToToday = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    setViewDate({ year: now.getFullYear(), month: now.getMonth() });
    onSelectDate(todayStr);
  };

  // Build grid of days matching the requested layout:
  // Starts on Sunday (0) and fills previous month days, current month days, and next month days up to 35 or 42 cells.
  const calendarCells = React.useMemo(() => {
    const { year, month } = viewDate;

    // First day of current month (0: Sunday, 1: Monday, ... 6: Saturday)
    const firstDayOfWeek = new Date(year, month, 1).getDay();

    // Days in current month
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();

    // Days in previous month
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells: Array<{
      dayNum: number;
      dateStr: string;
      isCurrentMonth: boolean;
      isSelected: boolean;
      isToday: boolean;
      count: number;
    }> = [];

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Previous month filler days
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevM = month === 0 ? 11 : month - 1;
      const prevY = month === 0 ? year - 1 : year;
      const dateStr = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      cells.push({
        dayNum,
        dateStr,
        isCurrentMonth: false,
        isSelected: dateStr === selectedDate,
        isToday: dateStr === todayStr,
        count: appointmentsCountByDate[dateStr] || 0,
      });
    }

    // Current month days
    for (let dayNum = 1; dayNum <= daysInCurrentMonth; dayNum++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      cells.push({
        dayNum,
        dateStr,
        isCurrentMonth: true,
        isSelected: dateStr === selectedDate,
        isToday: dateStr === todayStr,
        count: appointmentsCountByDate[dateStr] || 0,
      });
    }

    // Next month filler days (fill until total of 35 or 42 cells to create a complete balanced grid)
    const totalCells = cells.length > 35 ? 42 : 35;
    let nextDayNum = 1;
    while (cells.length < totalCells) {
      const nextM = month === 11 ? 0 : month + 1;
      const nextY = month === 11 ? year + 1 : year;
      const dateStr = `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(nextDayNum).padStart(2, '0')}`;
      cells.push({
        dayNum: nextDayNum,
        dateStr,
        isCurrentMonth: false,
        isSelected: dateStr === selectedDate,
        isToday: dateStr === todayStr,
        count: appointmentsCountByDate[dateStr] || 0,
      });
      nextDayNum++;
    }

    return cells;
  }, [viewDate, selectedDate, appointmentsCountByDate]);

  return (
    <div
      ref={containerRef}
      className={`select-none ${
        inline
          ? 'w-full bg-[#2b2d30] text-white rounded-2xl shadow-md border border-slate-700/80 p-3 sm:p-3.5'
          : 'w-[300px] sm:w-[320px] bg-[#2b2d30] text-white rounded-2xl shadow-2xl border border-slate-700/80 p-3 sm:p-4 animate-in fade-in zoom-in-95 duration-150'
      }`}
      onClick={e => e.stopPropagation()}
    >
      {/* Month & Year Navigation Header */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-700/60">
        <button
          type="button"
          onClick={prevMonth}
          className="p-1.5 rounded-lg hover:bg-slate-700/70 text-slate-300 hover:text-white transition-colors cursor-pointer"
          title="Mês anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-white tracking-wide">
            {monthNames[viewDate.month]} {viewDate.year}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-slate-700/70 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Próximo mês"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-700/70 text-slate-400 hover:text-white transition-colors cursor-pointer ml-0.5"
              title="Fechar calendário"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Weekday Headers: D  S  T  Q  Q  S  S */}
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {weekDayHeaders.map((day, idx) => (
          <div
            key={idx}
            className="text-xs sm:text-sm font-bold text-white/90 py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-y-1 gap-x-1 text-center">
        {calendarCells.map((cell, idx) => {
          return (
            <button
              key={idx}
              type="button"
              onClick={() => {
                onSelectDate(cell.dateStr);
              }}
              className="relative flex flex-col items-center justify-center h-8 sm:h-9 w-full group transition-all cursor-pointer rounded-lg"
              title={`${cell.dateStr}${cell.count > 0 ? ` (${cell.count} agendamento${cell.count > 1 ? 's' : ''})` : ''}`}
            >
              {/* Day Cell Container */}
              <div
                className={`
                  w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-md text-xs sm:text-sm transition-all
                  ${
                    cell.isSelected
                      ? 'bg-[#93c5fd] text-slate-900 font-extrabold shadow-md scale-105'
                      : cell.isCurrentMonth
                      ? 'text-white hover:bg-slate-700/70 font-semibold'
                      : 'text-slate-400 hover:bg-slate-700/40 hover:text-slate-200'
                  }
                  ${
                    cell.isToday && !cell.isSelected
                      ? 'ring-1 ring-amber-400/80 font-bold'
                      : ''
                  }
                `}
              >
                {cell.dayNum}
              </div>

              {/* Dot badge if day has appointments */}
              {cell.count > 0 && !cell.isSelected && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-emerald-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Quick Action Bar */}
      <div className="mt-3 pt-2.5 border-t border-slate-700/60 flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={goToToday}
          className="text-blue-400 hover:text-blue-300 font-semibold px-2 py-1 rounded-md hover:bg-slate-700/50 transition-colors"
        >
          Hoje
        </button>
        <div className="text-[11px] text-slate-400">
          Clique no dia para filtrar
        </div>
      </div>
    </div>
  );
};
