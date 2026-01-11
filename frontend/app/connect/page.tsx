
'use client';

import { useState } from 'react';
import { auth } from '@/lib/api';
import { Monitor, Save, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ConnectPage() {
    const [status, setStatus] = useState<'idle' | 'waiting' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

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
        <div className="mx-auto max-w-3xl p-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Connect Account</h1>
                <p className="mt-2 text-gray-600">
                    Since Twitter requires authentication, we need to grab your login session (cookies).
                </p>
            </div>

            <div className="grid gap-8 rounded-xl bg-white p-8 shadow-sm border border-gray-100">
                <div className="flex gap-4 items-start">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600 font-bold">1</div>
                    <div className="space-y-4 flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">Launch Login Browser</h3>
                        <p className="text-gray-500 text-sm">
                            Clicking this will open a Chrome window on your computer. Log in to Twitter manually in that window.
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

                <div className="relative flex items-center py-2">
                    <div className="flex-grow border-t border-gray-200"></div>
                    <span className="flex-shrink-0 mx-4 text-gray-400 text-sm">THEN</span>
                    <div className="flex-grow border-t border-gray-200"></div>
                </div>

                <div className="flex gap-4 items-start">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600 font-bold">2</div>
                    <div className="space-y-4 flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">Save Session</h3>
                        <p className="text-gray-500 text-sm">
                            Once you have successfully logged in on the popup window, click here to save your session.
                        </p>
                        <button
                            onClick={saveSession}
                            disabled={status !== 'waiting'}
                            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 disabled:opacity-50 disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                            <Save className="h-4 w-4" />
                            Save Session
                        </button>
                    </div>
                </div>

                {message && (
                    <div className={`mt-4 rounded-md p-4 flex items-center gap-3 border ${status === 'success' ? 'bg-green-50 text-green-700 border-green-200' :
                            status === 'error' ? 'bg-red-50 text-red-700 border-red-200' :
                                'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                        {status === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                        <p className="text-sm font-medium">{message}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
