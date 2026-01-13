
'use client';

import { useState, useEffect } from 'react';
import { auth } from '@/lib/api';
import { Monitor, Save, AlertCircle, CheckCircle2, RefreshCw, Power, User } from 'lucide-react';

interface Account {
    account_id: string;
    display_name: string;
    handle: string;
    is_active: boolean;
}

export default function ConnectPage() {
    const [status, setStatus] = useState<'idle' | 'waiting' | 'connecting' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    // Default accounts - shown even if API hasn't responded yet
    const [accounts, setAccounts] = useState<Account[]>([
        { account_id: 'adarsh', display_name: 'Adarsh', handle: '@adarsh', is_active: false },
        { account_id: 'kalidasa', display_name: 'DailyKalidasa', handle: '@dailykalidasaa', is_active: false }
    ]);
    const [selectedAccount, setSelectedAccount] = useState<string>('adarsh');
    const [sessionInfo, setSessionInfo] = useState<{
        connected: boolean;
        accountName: string;
        handle: string;
    } | null>(null);

    // Fetch accounts and session status on load
    useEffect(() => {
        fetchAccounts();
        checkSessionStatus();
    }, []);

    const fetchAccounts = async () => {
        try {
            const res = await fetch('http://localhost:8000/accounts');
            const data = await res.json();
            setAccounts(data.accounts);
            if (data.active_account) {
                setSelectedAccount(data.active_account);
            }
        } catch (err) {
            console.error('Failed to fetch accounts:', err);
        }
    };

    const checkSessionStatus = async () => {
        try {
            const res = await fetch('http://localhost:8000/session/status');
            const data = await res.json();
            if (data.status === 'connected') {
                setSessionInfo({
                    connected: true,
                    accountName: data.account_name,
                    handle: data.handle
                });
                setStatus('success');
            } else {
                setSessionInfo(null);
            }
        } catch (err) {
            console.error('Failed to check session:', err);
        }
    };

    const startSession = async () => {
        try {
            setStatus('connecting');
            setMessage('Connecting to Twitter...');

            const res = await fetch('http://localhost:8000/session/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ account_id: selectedAccount })
            });

            const data = await res.json();

            if (res.ok) {
                setStatus('success');
                setMessage(data.message);
                setSessionInfo({
                    connected: true,
                    accountName: data.account_name,
                    handle: data.handle
                });
                fetchAccounts(); // Refresh account list
            } else {
                setStatus('error');
                setMessage(data.detail || 'Connection failed');
            }
        } catch (err) {
            setStatus('error');
            setMessage('Failed to connect. Is the backend running?');
        }
    };

    const disconnectSession = async () => {
        try {
            await fetch('http://localhost:8000/session/disconnect', { method: 'POST' });
            setSessionInfo(null);
            setStatus('idle');
            setMessage('Disconnected successfully');
            fetchAccounts();
        } catch (err) {
            setStatus('error');
            setMessage('Failed to disconnect');
        }
    };

    const launchBrowser = async () => {
        try {
            setStatus('waiting');
            const res = await auth.connectBrowser();
            setMessage(res.data.message);
        } catch (err) {
            setStatus('error');
            setMessage('Failed to launch browser. Is backend running?');
        }
    };

    const saveSession = async () => {
        try {
            await auth.saveSession();
            setStatus('success');
            setMessage('Session saved successfully! You can now use automation.');
        } catch (err) {
            setStatus('error');
            setMessage('Failed to save session. Did you log in?');
        }
    };

    return (
        <div className="mx-auto max-w-4xl p-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white">Connect Account</h1>
                <p className="mt-2 text-gray-400">
                    Select a Twitter account and connect to start automation.
                </p>
            </div>

            {/* Account Selection Card */}
            <div className="mb-8 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 p-6 shadow-xl border border-gray-700">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <User className="h-5 w-5 text-sky-400" />
                    Select Account
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {accounts.map((account) => (
                        <button
                            key={account.account_id}
                            onClick={() => setSelectedAccount(account.account_id)}
                            className={`relative p-4 rounded-lg border-2 transition-all duration-200 text-left ${selectedAccount === account.account_id
                                ? 'border-sky-500 bg-sky-500/10'
                                : 'border-gray-600 bg-gray-800/50 hover:border-gray-500'
                                }`}
                        >
                            {account.is_active && (
                                <span className="absolute top-2 right-2 flex items-center gap-1 text-xs text-green-400">
                                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                                    Active
                                </span>
                            )}
                            <div className="font-semibold text-white text-lg">{account.display_name}</div>
                            <div className="text-gray-400 text-sm">{account.handle}</div>
                        </button>
                    ))}
                </div>

                <div className="mt-6 flex flex-wrap gap-4">
                    <button
                        onClick={startSession}
                        disabled={status === 'connecting'}
                        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:from-sky-400 hover:to-indigo-400 disabled:opacity-50 transition-all"
                    >
                        {status === 'connecting' ? (
                            <>
                                <RefreshCw className="h-4 w-4 animate-spin" />
                                Connecting...
                            </>
                        ) : (
                            <>
                                <Power className="h-4 w-4" />
                                Connect {accounts.find(a => a.account_id === selectedAccount)?.display_name || selectedAccount}
                            </>
                        )}
                    </button>

                    {sessionInfo?.connected && (
                        <button
                            onClick={disconnectSession}
                            className="inline-flex items-center gap-2 rounded-lg bg-red-600/20 border border-red-500 px-6 py-3 text-sm font-semibold text-red-400 hover:bg-red-600/30 transition-all"
                        >
                            <Power className="h-4 w-4" />
                            Disconnect
                        </button>
                    )}
                </div>
            </div>

            {/* Connection Status */}
            {sessionInfo?.connected && (
                <div className="mb-8 rounded-xl bg-gradient-to-r from-green-900/50 to-emerald-900/50 p-6 border border-green-500/30">
                    <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                            <CheckCircle2 className="h-6 w-6 text-green-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">Connected to {sessionInfo.accountName}</h3>
                            <p className="text-green-400">{sessionInfo.handle}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Status Message */}
            {message && (
                <div className={`mb-8 rounded-xl p-4 flex items-center gap-3 border ${status === 'success' ? 'bg-green-900/30 text-green-400 border-green-500/30' :
                    status === 'error' ? 'bg-red-900/30 text-red-400 border-red-500/30' :
                        'bg-sky-900/30 text-sky-400 border-sky-500/30'
                    }`}>
                    {status === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                    <p className="text-sm font-medium">{message}</p>
                </div>
            )}

            {/* Manual Login Section (Collapsible) */}
            <details className="rounded-xl bg-gray-800/50 border border-gray-700 overflow-hidden">
                <summary className="cursor-pointer p-4 text-gray-300 hover:bg-gray-800 transition-colors">
                    <span className="font-semibold">Manual Login (Advanced)</span>
                    <span className="text-gray-500 text-sm ml-2">- For setting up new accounts</span>
                </summary>

                <div className="p-6 border-t border-gray-700">
                    <div className="grid gap-6">
                        <div className="flex gap-4 items-start">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-900/50 text-sky-400 font-bold border border-sky-500/30">1</div>
                            <div className="space-y-4 flex-1">
                                <h3 className="text-lg font-semibold text-white">Launch Login Browser</h3>
                                <p className="text-gray-400 text-sm">
                                    Opens a Chrome window. Log in to Twitter manually in that window.
                                </p>
                                <button
                                    onClick={launchBrowser}
                                    disabled={status === 'waiting'}
                                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
                                >
                                    <Monitor className="h-4 w-4" />
                                    {status === 'waiting' ? 'Browser Launched...' : 'Launch Browser'}
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-4 items-start">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-900/50 text-sky-400 font-bold border border-sky-500/30">2</div>
                            <div className="space-y-4 flex-1">
                                <h3 className="text-lg font-semibold text-white">Save Session</h3>
                                <p className="text-gray-400 text-sm">
                                    Once logged in, click here to save your session cookies.
                                </p>
                                <button
                                    onClick={saveSession}
                                    disabled={status !== 'waiting'}
                                    className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 disabled:opacity-50 disabled:bg-gray-600 disabled:cursor-not-allowed"
                                >
                                    <Save className="h-4 w-4" />
                                    Save Session
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </details>
        </div>
    );
}
