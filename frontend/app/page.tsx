import Link from 'next/link';
import { ArrowRight, Twitter, Activity, Zap } from 'lucide-react';
import ActivityPreview from '@/components/ActivityPreview';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center pt-24 pb-12 px-6">

      {/* Activity Preview - Shows if data exists */}
      <div className="w-full max-w-4xl">
        <ActivityPreview />
      </div>

      {/* Hero Section */}
      <div className="max-w-4xl text-center space-y-8 animate-in fade-in zoom-in duration-700">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/60 border border-white/40 shadow-xs backdrop-blur-md">
          <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
          <span className="text-xs font-medium text-gray-600 tracking-wide uppercase">AI-Powered Automation V1.0</span>
        </div>

        <h1 className="text-6xl md:text-7xl font-bold tracking-tight text-gray-900">
          Automate your <br />
          <span className="bg-clip-text text-transparent bg-linear-to-r from-teal-400 to-cyan-600">
            Twitter Presence
          </span>
        </h1>

        <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
          Manage, schedule, and analyze your tweets with advanced AI agents.
          Experience the future of social media automation with a seamless, intelligent interface.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link href="/upload" className="group relative px-8 py-4 rounded-full bg-gray-900 text-white font-medium hover:bg-gray-800 transition-all hover:scale-105 hover:shadow-xl flex items-center gap-2">
            Start Posting
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link href="/analyze" className="px-8 py-4 rounded-full bg-white text-gray-900 border border-gray-200 font-medium hover:bg-gray-50 transition-all hover:scale-105 hover:border-gray-300 flex items-center gap-2 shadow-sm">
            View Analytics
          </Link>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full mt-24">
        {[
          {
            title: "Smart Composition",
            desc: "Draft tweets with AI assistance and instant previews.",
            icon: Zap,
            color: "from-yellow-200 to-orange-100"
          },
          {
            title: "Deep Analytics",
            desc: "Understand your audience with detailed engagement metrics.",
            icon: Activity,
            color: "from-blue-200 to-indigo-100"
          },
          {
            title: "Automated Growth",
            desc: "Let your agent handle interactions and grow your reach.",
            icon: Twitter,
            color: "from-teal-200 to-emerald-100"
          }
        ].map((feature, i) => (
          <div key={i} className="group p-8 rounded-3xl glass-panel hover:bg-white/80 transition-all hover:-translate-y-1">
            <div className={`w-12 h-12 rounded-2xl bg-linear-to-br ${feature.color} flex items-center justify-center mb-6`}>
              <feature.icon className="text-gray-700" size={24} />
            </div>
            <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
            <p className="text-gray-500 leading-relaxed">{feature.desc}</p>
          </div>
        ))}
      </div>

    </div>
  );
}
