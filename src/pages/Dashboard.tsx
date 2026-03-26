import React, { useEffect, useState } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { 
  Smile, 
  AlertCircle, 
  TrendingUp,
  BrainCircuit,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { useLanguage } from '../lib/language-context';
import { getBackendSource, getDashboardSummary, getRecentEvents } from '@/src/lib/api';
import { useAuth } from '../lib/auth-context';

const COLORS = {
  Happy: '#3B82F6',
  Sad: '#F43F5E',
  Neutral: '#94A3B8',
  Angry: '#F59E0B',
  Surprised: '#8B5CF6',
  Fearful: '#10B981',
  Disgusted: '#6366F1'
};

export default function Dashboard() {
  const { language } = useLanguage();
  const {
    user,
    children,
    selectedChildId,
    setSelectedChildId,
    createChildUser,
  } = useAuth();

  const [childName, setChildName] = useState('');
  const [childUsername, setChildUsername] = useState('');
  const [childAge, setChildAge] = useState('');
  const [childGrade, setChildGrade] = useState('');
  const [childInterests, setChildInterests] = useState('');
  const [childPassword, setChildPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [pieData, setPieData] = useState<any[]>([]);
  const [stats, setStats] = useState({
    primary: 'None',
    confidence: '0%',
    interactions: 0,
    alerts: 0
  });

  useEffect(() => {
    if (!user) {
      setHistory([]);
      setPieData([]);
      setStats({
        primary: 'None',
        confidence: '0%',
        interactions: 0,
        alerts: 0,
      });
      return;
    }

    const loadData = async () => {
      try {
        const source = getBackendSource();
        const [recentEvents, summary] = await Promise.all([
          getRecentEvents(100, source, selectedChildId || undefined),
          getDashboardSummary(24, source, selectedChildId || undefined),
        ]);

        setHistory(recentEvents);

        if (recentEvents.length > 0) {
          const counts: Record<string, number> = {};
          recentEvents.forEach((item: any) => {
            counts[item.emotion] = (counts[item.emotion] || 0) + 1;
          });

          const formattedPie = Object.entries(counts).map(([name, value]) => ({
            name,
            value: Math.round((value / recentEvents.length) * 100),
            color: COLORS[name as keyof typeof COLORS] || '#ccc'
          }));
          setPieData(formattedPie);
        } else {
          setPieData([]);
        }

        setStats({
          primary: summary.primary_emotion || 'None',
          confidence: `${summary.avg_confidence.toFixed(1)}%`,
          interactions: summary.total_events,
          alerts: summary.alert_events,
        });
      } catch (loadError) {
        console.error('Failed to load dashboard data from API', loadError);
      }
    };

    loadData();
  }, [user, selectedChildId]);

  const handleCreateChild = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthError(null);
    setIsSubmittingAuth(true);
    try {
      await createChildUser({
        name: childName,
        username: childUsername,
        age: childAge ? Number(childAge) : undefined,
        grade: childGrade || undefined,
        interests: childInterests
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        password: childPassword,
      });
      setChildName('');
      setChildUsername('');
      setChildAge('');
      setChildGrade('');
      setChildInterests('');
      setChildPassword('');
    } catch (error: any) {
      setAuthError(error?.message || 'Failed to create child account');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const chartData = history.slice(-10).map(h => ({
    time: new Date(h.detected_at || h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    value: h.emotion === 'Happy' ? 100 : h.emotion === 'Neutral' ? 50 : 0
  }));

  const text = {
    en: {
      primaryEmotion: 'Primary Emotion',
      averageConfidence: 'Average Confidence',
      sessionDetections: 'Session Detections',
      alerts: 'Alerts (Sad/Angry)',
      trendTitle: 'Recent Emotion Trend',
      trendSubtitle: 'Real-time session data',
      trendEmpty: 'No session data yet. Go to Live Monitor to start detection.',
      sessionDistribution: 'Session Distribution',
      waitingForData: 'Waiting for data...',
      insightsTitle: 'Zara Real-Time Insights',
      insightsIntro: 'Based on your current session data:',
      positiveTip: 'Great progress. The child is showing stronger positive engagement.',
      neutralTip: 'Consider a short break or a fun activity to shift the mood.',
      startMonitorTip: 'Start live monitoring to receive AI insights.',
      sessionAlerts: 'Session Alerts',
      attentionNeeded: 'Needs Attention',
      attentionSummary: `This session has detected ${stats.alerts} sad/angry emotions.`,
      allGood: 'All Good',
      allGoodSummary: 'No negative emotional shifts have been detected so far.',
    },
    ta: {
      primaryEmotion: 'முக்கிய உணர்வு',
      averageConfidence: 'சராசரி நம்பிக்கை',
      sessionDetections: 'அமர்வு கண்டறிதல்கள்',
      alerts: 'எச்சரிக்கைகள் (சோகம்/கோபம்)',
      trendTitle: 'சமீபத்திய உணர்வு ஓட்டம்',
      trendSubtitle: 'நிகழ்நேர அமர்வு தரவு',
      trendEmpty: 'இன்னும் அமர்வு தரவு இல்லை. கண்டறிதலைத் தொடங்க நேரடி கண்காணிப்பிற்குச் செல்லவும்.',
      sessionDistribution: 'அமர்வு விநியோகம்',
      waitingForData: 'தரவிற்காகக் காத்திருக்கிறது...',
      insightsTitle: 'சாராவின் நிகழ்நேர நுண்ணறிவு',
      insightsIntro: 'உங்கள் தற்போதைய அமர்வு தரவின் அடிப்படையில்:',
      positiveTip: 'சிறந்த வேலை! குழந்தை அதிக நேர்மறையான ஈடுபாட்டைக் காட்டுகிறது.',
      neutralTip: 'மனநிலையை மாற்ற ஒரு சிறிய இடைவெளி அல்லது வேடிக்கையான செயல்பாட்டைக் கருத்தில் கொள்ளுங்கள்.',
      startMonitorTip: 'AI நுண்ணறிவுகளைப் பெற நேரடி கண்காணிப்பைத் தொடங்கவும்.',
      sessionAlerts: 'அமர்வு எச்சரிக்கைகள்',
      attentionNeeded: 'கவனம் தேவை',
      attentionSummary: `இந்த அமர்வில் ${stats.alerts} சோகம்/கோபம் உணர்வுகள் கண்டறியப்பட்டுள்ளன.`,
      allGood: 'எல்லாம் சரி',
      allGoodSummary: 'இதுவரை எதிர்மறையான உணர்ச்சி மாற்றங்கள் எதுவும் கண்டறியப்படவில்லை.',
    },
  }[language];

  const translateEmotion = (emotion: string) => {
    if (language === 'en') {
      return emotion;
    }

    const translations: { [key: string]: string } = {
      'Happy': 'மகிழ்ச்சி',
      'Sad': 'சோகம்',
      'Neutral': 'சாதாரண',
      'Angry': 'கோபம்',
      'Surprised': 'ஆச்சரியம்',
      'Fearful': 'பயம்',
      'Disgusted': 'வெறுப்பு',
      'None': 'இல்லை'
    };
    return translations[emotion] || emotion;
  };

  const coachTips = {
    Happy: 'You are doing amazing. Keep sharing what made you smile today.',
    Sad: 'It is okay to feel sad. Try drawing your feelings for a few minutes.',
    Neutral: 'A short game or music break can help your mood feel lighter.',
    Angry: 'Take five deep breaths slowly, then talk to a trusted adult.',
    Surprised: 'That was unexpected. Tell what happened in your own words.',
    Fearful: 'You are safe. Hold your favorite toy and breathe slowly.',
    Disgusted: 'Take a quick pause and move to a place that feels comfortable.',
    None: 'Start a live monitor session and I will guide you step by step.',
  };

  const childTip = coachTips[stats.primary as keyof typeof coachTips] || coachTips.None;
  const happyScore = pieData.find((item) => item.name === 'Happy')?.value || 0;
  const calmScore = (pieData.find((item) => item.name === 'Neutral')?.value || 0) + happyScore;
  const recentMoments = history.slice(-3).reverse();

  return (
    <div className="space-y-8">
      {user?.role === 'child' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800">My Profile</h3>
          <p className="text-sm text-slate-500 mt-1">Your profile details stored in EmoCare.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
              <p className="text-xs text-slate-500">Username</p>
              <p className="text-sm font-semibold text-slate-800 mt-1">{user.username || '-'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
              <p className="text-xs text-slate-500">Parent ID</p>
              <p className="text-sm font-semibold text-slate-800 mt-1">{user.parent_id || '-'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
              <p className="text-xs text-slate-500">Age</p>
              <p className="text-sm font-semibold text-slate-800 mt-1">{user.age || '-'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
              <p className="text-xs text-slate-500">Grade</p>
              <p className="text-sm font-semibold text-slate-800 mt-1">{user.grade || '-'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 md:col-span-2 lg:col-span-1">
              <p className="text-xs text-slate-500">Interests</p>
              <p className="text-sm font-semibold text-slate-800 mt-1">
                {user.interests && user.interests.length > 0 ? user.interests.join(', ') : '-'}
              </p>
            </div>
          </div>
        </div>
      )}

      {user?.role === 'parent' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Child Selector</h3>
              <p className="text-sm text-slate-500">Choose a child profile to view scoped synced data. Parent ID: {user.user_id}</p>
            </div>
            <select
              value={selectedChildId || ''}
              onChange={(e) => setSelectedChildId(e.target.value || null)}
              className="border border-slate-200 rounded-xl px-4 py-2 text-sm"
            >
              {children.length === 0 && <option value="">No child accounts yet</option>}
              {children.map((child) => (
                <option key={child.user_id} value={child.user_id}>
                  {child.name} ({child.username || child.email || child.user_id})
                </option>
              ))}
            </select>
          </div>

          <form onSubmit={handleCreateChild} className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <input
              type="text"
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              placeholder="Child name"
              className="border border-slate-200 rounded-xl px-4 py-2 text-sm"
              required
            />
            <input
              type="text"
              value={childUsername}
              onChange={(e) => setChildUsername(e.target.value)}
              placeholder="Child username"
              className="border border-slate-200 rounded-xl px-4 py-2 text-sm"
              required
            />
            <input
              type="number"
              min={1}
              max={18}
              value={childAge}
              onChange={(e) => setChildAge(e.target.value)}
              placeholder="Age"
              className="border border-slate-200 rounded-xl px-4 py-2 text-sm"
            />
            <input
              type="text"
              value={childGrade}
              onChange={(e) => setChildGrade(e.target.value)}
              placeholder="Grade"
              className="border border-slate-200 rounded-xl px-4 py-2 text-sm"
            />
            <input
              type="text"
              value={childInterests}
              onChange={(e) => setChildInterests(e.target.value)}
              placeholder="Interests (comma separated)"
              className="border border-slate-200 rounded-xl px-4 py-2 text-sm"
            />
            <input
              type="password"
              value={childPassword}
              onChange={(e) => setChildPassword(e.target.value)}
              placeholder="Child password"
              className="border border-slate-200 rounded-xl px-4 py-2 text-sm"
              required
            />
            <button
              type="submit"
              disabled={isSubmittingAuth}
              className="bg-emerald-600 text-white rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Add Child
            </button>
          </form>
          {authError && <p className="text-sm text-rose-600">{authError}</p>}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title={text.primaryEmotion}
          value={translateEmotion(stats.primary)} 
          icon={Smile} 
          color="bg-blue-500" 
        />
        <StatCard 
          title={text.averageConfidence}
          value={stats.confidence} 
          icon={BrainCircuit} 
          color="bg-purple-500"
        />
        <StatCard 
          title={text.sessionDetections}
          value={stats.interactions} 
          icon={TrendingUp} 
          color="bg-emerald-500"
        />
        <StatCard 
          title={text.alerts}
          value={stats.alerts} 
          icon={AlertCircle} 
          color="bg-rose-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Emotion Trend */}
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-lg font-bold text-slate-800">{text.trendTitle}</h2>
            <p className="text-xs text-slate-400">{text.trendSubtitle}</p>
          </div>
          <div className="h-[300px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 12}} domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Line type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4, fill: '#3B82F6' }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-300 italic">
                {text.trendEmpty}
              </div>
            )}
          </div>
        </div>

        {/* Behavior Summary */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-8">{text.sessionDistribution}</h2>
          <div className="h-[250px]">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-300 italic">
                {text.waitingForData}
              </div>
            )}
          </div>
          <div className="space-y-4 mt-4">
            {pieData.map((item) => (
              <div key={item.name} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-slate-600">{translateEmotion(item.name)}</span>
                </div>
                <span className="text-sm font-bold text-slate-800">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Suggestions & Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-blue-600 p-8 rounded-3xl text-white shadow-lg shadow-blue-200">
          <div className="flex items-center gap-3 mb-4">
            <BrainCircuit className="w-6 h-6" />
            <h2 className="text-lg font-bold">{text.insightsTitle}</h2>
          </div>
          <p className="text-blue-100 mb-6">{text.insightsIntro}</p>
          <ul className="space-y-3">
            {stats.primary === 'Happy' ? (
              <li className="bg-white/10 p-3 rounded-2xl flex items-center gap-3">
                <span className="bg-white/20 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">✓</span>
                <span>{text.positiveTip}</span>
              </li>
            ) : stats.primary !== 'None' ? (
              <li className="bg-white/10 p-3 rounded-2xl flex items-center gap-3">
                <span className="bg-white/20 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">!</span>
                <span>{text.neutralTip}</span>
              </li>
            ) : (
              <li className="bg-white/10 p-3 rounded-2xl flex items-center gap-3">
                <span>{text.startMonitorTip}</span>
              </li>
            )}
          </ul>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-6">{text.sessionAlerts}</h2>
          <div className="space-y-4">
            {stats.alerts > 0 ? (
              <div className="flex gap-4 p-4 bg-rose-50 rounded-2xl border border-rose-100">
                <div className="bg-rose-500 p-2 rounded-xl h-fit">
                  <AlertCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-rose-900 text-sm">{text.attentionNeeded}</h4>
                  <p className="text-rose-700 text-xs mt-1">{text.attentionSummary}</p>
                </div>
              </div>
            ) : (
              <div className="flex gap-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                <div className="bg-emerald-500 p-2 rounded-xl h-fit">
                  <Smile className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-emerald-900 text-sm">{text.allGood}</h4>
                  <p className="text-emerald-700 text-xs mt-1">{text.allGoodSummary}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {user?.role === 'child' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 bg-gradient-to-br from-cyan-500 to-blue-600 p-8 rounded-3xl text-white shadow-xl shadow-cyan-200/70">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="w-6 h-6" />
              <h2 className="text-xl font-bold">My Mood Coach</h2>
            </div>
            <p className="text-cyan-50 text-sm mb-5">Personal tip based on your latest mood trend.</p>
            <p className="bg-white/15 rounded-2xl p-4 text-sm leading-relaxed">{childTip}</p>
            <div className="grid grid-cols-2 gap-3 mt-5">
              <div className="bg-white/15 rounded-2xl p-3">
                <p className="text-xs text-cyan-100">Joy + Calm Score</p>
                <p className="text-2xl font-bold">{calmScore}%</p>
              </div>
              <div className="bg-white/15 rounded-2xl p-3">
                <p className="text-xs text-cyan-100">Positive Moments</p>
                <p className="text-2xl font-bold">{happyScore}%</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="text-lg font-bold text-slate-800">Recent Moments</h3>
            </div>
            <div className="space-y-3">
              {recentMoments.length === 0 && (
                <p className="text-sm text-slate-500">No moments yet. Start Live Monitor to fill this list.</p>
              )}
              {recentMoments.map((moment) => (
                <div key={moment.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-sm font-semibold text-slate-700">{translateEmotion(moment.emotion)}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(moment.detected_at || moment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {Math.round(moment.confidence)}%
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const StatCard = ({ title, value, icon: Icon, color }: any) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"
  >
    <div className="flex justify-between items-start mb-4">
      <div className={cn("p-3 rounded-2xl", color)}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
    <h3 className="text-slate-500 text-sm font-medium">{title}</h3>
    <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
  </motion.div>
);
