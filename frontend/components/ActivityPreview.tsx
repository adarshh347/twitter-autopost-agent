"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { ArrowRight, Flame } from 'lucide-react';

export default function ActivityPreview() {
    const [data, setData] = useState<Record<string, number>>({});
    const [streak, setStreak] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [heatmapRes, statsRes] = await Promise.all([
                    axios.get('http://localhost:8000/tweets/heatmap?days=90'),
                    axios.get('http://localhost:8000/tweets/stats')
                ]);
                setData(heatmapRes.data.heatmap || {});
                setStreak(statsRes.data.stats?.current_streak || 0);
            } catch {
                // Silently fail for preview
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Generate last 12 weeks of mini heatmap
    const miniGrid = [];
    const today = new Date();
    for (let week = 11; week >= 0; week--) {
        const weekDays = [];
        for (let day = 0; day < 7; day++) {
            const d = new Date(today);
            d.setDate(d.getDate() - (week * 7 + (6 - day)));
            const dateStr = d.toISOString().split('T')[0];
            const count = data[dateStr] || 0;
            weekDays.push({ date: dateStr, count });
        }
        miniGrid.push(weekDays);
    }

    const getColor = (count: number) => {
        if (count === 0) return 'bg-gray-100';
        if (count === 1) return 'bg-teal-200';
        if (count <= 3) return 'bg-teal-300';
        return 'bg-teal-400';
    };

    const totalTweets = Object.values(data).reduce((a, b) => a + b, 0);
    const activeDays = Object.keys(data).length;

    if (loading || Object.keys(data).length === 0) {
        return null; // Don't show if no data
    }

    return (
        <div className="glass-panel p-6 rounded-3xl max-w-lg mx-auto mt-16">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-500">
                        <Flame size={18} />
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-gray-900">
                            {streak} day streak
                        </div>
                        <div className="text-xs text-gray-500">
                            {totalTweets} tweets in {activeDays} days
                        </div>
                    </div>
                </div>
                <Link
                    href="/analyze"
                    className="text-xs font-medium text-teal-600 hover:text-teal-700 flex items-center gap-1"
                >
                    View full <ArrowRight size={12} />
                </Link>
            </div>

            {/* Mini Heatmap */}
            <div className="flex gap-[2px]">
                {miniGrid.map((week, wi) => (
                    <div key={wi} className="flex flex-col gap-[2px]">
                        {week.map((day, di) => (
                            <div
                                key={`${wi}-${di}`}
                                className={`w-2 h-2 rounded-[2px] ${getColor(day.count)}`}
                                title={`${day.date}: ${day.count} tweets`}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
