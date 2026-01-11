"use client";

import { useMemo } from 'react';
import { clsx } from 'clsx';

interface HeatmapProps {
    data: Record<string, number>;  // { "YYYY-MM-DD": count }
    weeks?: number;
}

export default function ActivityHeatmap({ data, weeks = 52 }: HeatmapProps) {

    // Generate all dates for the heatmap grid
    const { grid, months, maxCount } = useMemo(() => {
        const today = new Date();
        const totalDays = weeks * 7;
        const dates: { date: string; count: number; dayOfWeek: number }[][] = [];

        // Find max count for color scaling
        let max = 0;
        Object.values(data).forEach((count) => {
            if (count > max) max = count;
        });
        if (max === 0) max = 1; // Prevent division by zero

        // Build grid week by week
        let currentWeek: { date: string; count: number; dayOfWeek: number }[] = [];
        const monthLabels: { label: string; weekIndex: number }[] = [];
        let lastMonth = -1;

        for (let i = totalDays - 1; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);

            const dateStr = d.toISOString().split('T')[0];
            const dayOfWeek = d.getDay();
            const month = d.getMonth();

            // Track month changes for labels
            if (month !== lastMonth) {
                monthLabels.push({
                    label: d.toLocaleString('default', { month: 'short' }),
                    weekIndex: dates.length
                });
                lastMonth = month;
            }

            currentWeek.push({
                date: dateStr,
                count: data[dateStr] || 0,
                dayOfWeek
            });

            // End of week (Saturday) or first day
            if (dayOfWeek === 6 || i === 0) {
                dates.push(currentWeek);
                currentWeek = [];
            }
        }

        return { grid: dates, months: monthLabels, maxCount: max };
    }, [data, weeks]);

    // Get color intensity based on count
    const getColorClass = (count: number): string => {
        if (count === 0) return 'bg-gray-100 dark:bg-gray-800';

        const intensity = count / maxCount;

        if (intensity <= 0.25) return 'bg-teal-200';
        if (intensity <= 0.5) return 'bg-teal-300';
        if (intensity <= 0.75) return 'bg-teal-400';
        return 'bg-teal-500';
    };

    const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

    return (
        <div className="w-full overflow-x-auto">
            <div className="inline-block min-w-max">
                {/* Month labels */}
                <div className="flex mb-1 ml-8 text-[10px] text-gray-400 font-medium">
                    {months.map((m, i) => (
                        <div
                            key={i}
                            className="flex-shrink-0"
                            style={{
                                width: `${(months[i + 1]?.weekIndex ?? grid.length) - m.weekIndex}rem`,
                                marginLeft: i === 0 ? `${m.weekIndex * 0.75}rem` : 0
                            }}
                        >
                            {m.label}
                        </div>
                    ))}
                </div>

                <div className="flex gap-0.5">
                    {/* Day of week labels */}
                    <div className="flex flex-col gap-[2px] mr-1 text-[9px] text-gray-400 font-medium justify-around py-0.5">
                        {dayLabels.map((label, i) => (
                            <div key={i} className="h-[10px] flex items-center justify-end pr-1 w-6">
                                {label}
                            </div>
                        ))}
                    </div>

                    {/* Heatmap Grid */}
                    <div className="flex gap-[2px]">
                        {grid.map((week, weekIdx) => (
                            <div key={weekIdx} className="flex flex-col gap-[2px]">
                                {/* Pad first week if needed */}
                                {weekIdx === 0 && week[0]?.dayOfWeek > 0 && (
                                    Array.from({ length: week[0].dayOfWeek }).map((_, i) => (
                                        <div key={`pad-${i}`} className="w-[10px] h-[10px]" />
                                    ))
                                )}

                                {week.map((day, dayIdx) => (
                                    <div
                                        key={`${weekIdx}-${dayIdx}`}
                                        className={clsx(
                                            "w-[10px] h-[10px] rounded-[2px] transition-all hover:scale-125 hover:ring-2 hover:ring-teal-300/50 cursor-pointer",
                                            getColorClass(day.count)
                                        )}
                                        title={`${day.date}: ${day.count} tweet${day.count !== 1 ? 's' : ''}`}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Legend */}
                <div className="flex items-center justify-end mt-3 gap-1 text-[10px] text-gray-400">
                    <span>Less</span>
                    <div className="w-[10px] h-[10px] rounded-[2px] bg-gray-100" />
                    <div className="w-[10px] h-[10px] rounded-[2px] bg-teal-200" />
                    <div className="w-[10px] h-[10px] rounded-[2px] bg-teal-300" />
                    <div className="w-[10px] h-[10px] rounded-[2px] bg-teal-400" />
                    <div className="w-[10px] h-[10px] rounded-[2px] bg-teal-500" />
                    <span>More</span>
                </div>
            </div>
        </div>
    );
}
