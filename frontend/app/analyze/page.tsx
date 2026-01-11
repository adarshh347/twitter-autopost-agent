"use client";

import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, RefreshCw, Calendar, Flame, Clock, Loader2 } from 'lucide-react';
import axios from 'axios';
import { motion } from 'framer-motion';
import ActivityHeatmap from '@/components/ActivityHeatmap';

interface Stats {
    total_tweets: number;
    type_breakdown: Record<string, number>;
    tweets_last_7_days: number;
    current_streak: number;
}

interface SyncInfo {
    last_sync_at: string;
    total_tweets_synced: number;
}

export default function AnalyzePage() {
    const [heatmapData, setHeatmapData] = useState<Record<string, number>>({});
    const [stats, setStats] = useState<Stats | null>(null);
    const [syncInfo, setSyncInfo] = useState<SyncInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [heatmapRes, statsRes] = await Promise.all([
                axios.get('http://localhost:8000/tweets/heatmap?days=365'),
                axios.get('http://localhost:8000/tweets/stats')
            ]);

            setHeatmapData(heatmapRes.data.heatmap || {});
            setStats(statsRes.data.stats || null);
            setSyncInfo(statsRes.data.last_sync || null);
        } catch (err) {
            console.error("Failed to fetch data", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async (fullSync = false) => {
        setSyncing(true);
        setSyncMessage(null);
        try {
            const res = await axios.post('http://localhost:8000/tweets/sync', {
                force_full_sync: fullSync
            });
            setSyncMessage(res.data.message);
            // Refresh data after sync
            await fetchData();
        } catch (err: any) {
            setSyncMessage(err.response?.data?.detail || "Sync failed. Is browser session active?");
        } finally {
            setSyncing(false);
        }
    };

    const formatDate = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="min-h-screen pt-28 pb-12 px-6 max-w-7xl mx-auto">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-10">
                <div>
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">Activity Analytics</h1>
                    <p className="text-gray-500">
                        Track your posting consistency and growth.
                        {syncInfo?.last_sync_at && (
                            <span className="ml-2 text-xs bg-gray-100 px-2 py-1 rounded-full">
                                Last sync: {formatDate(syncInfo.last_sync_at)}
                            </span>
                        )}
                    </p>
                </div>

                <div className="flex gap-3 mt-4 md:mt-0">
                    <button
                        onClick={() => handleSync(false)}
                        disabled={syncing}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all text-sm font-medium shadow-sm disabled:opacity-50"
                    >
                        {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                        Sync New
                    </button>
                    <button
                        onClick={() => handleSync(true)}
                        disabled={syncing}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white hover:bg-gray-800 transition-all text-sm font-medium shadow-sm disabled:opacity-50"
                    >
                        Full Sync
                    </button>
                </div>
            </div>

            {/* Sync Message */}
            {syncMessage && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 rounded-xl bg-teal-50 text-teal-700 border border-teal-100 text-sm"
                >
                    {syncMessage}
                </motion.div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                {[
                    {
                        label: "Total Tweets",
                        value: loading ? "..." : stats?.total_tweets || 0,
                        icon: BarChart3,
                        color: "text-blue-500",
                        bg: "bg-blue-50"
                    },
                    {
                        label: "This Week",
                        value: loading ? "..." : stats?.tweets_last_7_days || 0,
                        icon: Calendar,
                        color: "text-purple-500",
                        bg: "bg-purple-50"
                    },
                    {
                        label: "Current Streak",
                        value: loading ? "..." : `${stats?.current_streak || 0} days`,
                        icon: Flame,
                        color: "text-orange-500",
                        bg: "bg-orange-50"
                    },
                    {
                        label: "Avg/Day",
                        value: loading ? "..." : (Object.keys(heatmapData).length > 0
                            ? (Object.values(heatmapData).reduce((a, b) => a + b, 0) / Object.keys(heatmapData).length).toFixed(1)
                            : "0"),
                        icon: TrendingUp,
                        color: "text-green-500",
                        bg: "bg-green-50"
                    },
                ].map((stat, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="glass-panel p-5 rounded-2xl"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className={`p-2 rounded-lg ${stat.bg} ${stat.color}`}>
                                <stat.icon size={18} />
                            </div>
                        </div>
                        <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                        <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
                    </motion.div>
                ))}
            </div>

            {/* Heatmap Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-panel p-8 rounded-3xl mb-8"
            >
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-xl font-semibold text-gray-900">Posting Activity</h3>
                        <p className="text-sm text-gray-500 mt-1">
                            {Object.values(heatmapData).reduce((a, b) => a + b, 0)} tweets in the last year
                        </p>
                    </div>
                </div>

                {loading ? (
                    <div className="h-32 flex items-center justify-center text-gray-400">
                        <Loader2 className="animate-spin mr-2" size={20} />
                        Loading activity data...
                    </div>
                ) : Object.keys(heatmapData).length === 0 ? (
                    <div className="h-32 flex flex-col items-center justify-center text-gray-400">
                        <Calendar size={32} className="mb-2 opacity-50" />
                        <p>No activity data yet. Click "Full Sync" to fetch your tweets.</p>
                    </div>
                ) : (
                    <ActivityHeatmap data={heatmapData} weeks={52} />
                )}
            </motion.div>

            {/* Type Breakdown */}
            {stats?.type_breakdown && Object.keys(stats.type_breakdown).length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="glass-panel p-8 rounded-3xl"
                >
                    <h3 className="text-xl font-semibold text-gray-900 mb-6">Tweet Types</h3>
                    <div className="flex flex-wrap gap-4">
                        {Object.entries(stats.type_breakdown).map(([type, count]) => (
                            <div
                                key={type}
                                className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-100 shadow-xs"
                            >
                                <div className="w-3 h-3 rounded-full bg-teal-400" />
                                <div>
                                    <div className="text-lg font-semibold text-gray-900">{count}</div>
                                    <div className="text-xs text-gray-500 capitalize">{type}s</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

        </div>
    );
}
