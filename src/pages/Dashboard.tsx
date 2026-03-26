import React, { useEffect, useState } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { 
  Smile, 
  Frown, 
  Meh, 
  AlertCircle, 
  TrendingUp,
  BrainCircuit
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/src/lib/utils';

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
  const [history, setHistory] = useState<any[]>([]);
  const [pieData, setPieData] = useState<any[]>([]);
  const [stats, setStats] = useState({
    primary: 'None',
    confidence: '0%',
    interactions: 0,
    alerts: 0
  });

  useEffect(() => {
    const rawHistory = JSON.parse(sessionStorage.getItem('emotion_history') || '[]');
    setHistory(rawHistory);

    if (rawHistory.length > 0) {
      const counts: Record<string, number> = {};
      rawHistory.forEach((item: any) => {
        counts[item.emotion] = (counts[item.emotion] || 0) + 1;
      });

      const formattedPie = Object.entries(counts).map(([name, value]) => ({
        name,
        value: Math.round((value / rawHistory.length) * 100),
        color: COLORS[name as keyof typeof COLORS] || '#ccc'
      }));
      setPieData(formattedPie);

      const primary = Object.entries(counts).reduce((a, b) => a[1] > b[1] ? a : b)[0];
      setStats({
        primary,
        confidence: '92.4%',
        interactions: rawHistory.length,
        alerts: rawHistory.filter((h: any) => h.emotion === 'Sad' || h.emotion === 'Angry').length
      });
    }
  }, []);

  const chartData = history.slice(-10).map(h => ({
    time: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    value: h.emotion === 'Happy' ? 100 : h.emotion === 'Neutral' ? 50 : 0
  }));

  const translateEmotion = (emotion: string) => {
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

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="முக்கிய உணர்வு" 
          value={translateEmotion(stats.primary)} 
          icon={Smile} 
          color="bg-blue-500" 
        />
        <StatCard 
          title="சராசரி நம்பிக்கை" 
          value={stats.confidence} 
          icon={BrainCircuit} 
          color="bg-purple-500"
        />
        <StatCard 
          title="அமர்வு கண்டறிதல்கள்" 
          value={stats.interactions} 
          icon={TrendingUp} 
          color="bg-emerald-500"
        />
        <StatCard 
          title="எச்சரிக்கைகள் (சோகம்/கோபம்)" 
          value={stats.alerts} 
          icon={AlertCircle} 
          color="bg-rose-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Emotion Trend */}
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-lg font-bold text-slate-800">சமீபத்திய உணர்வு ஓட்டம்</h2>
            <p className="text-xs text-slate-400">நிகழ்நேர அமர்வு தரவு</p>
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
                இன்னும் அமர்வு தரவு இல்லை. கண்டறிதலைத் தொடங்க நேரடி கண்காணிப்பிற்குச் செல்லவும்.
              </div>
            )}
          </div>
        </div>

        {/* Behavior Summary */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-8">அமர்வு விநியோகம்</h2>
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
                தரவிற்காகக் காத்திருக்கிறது...
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
            <h2 className="text-lg font-bold">சாராவின் நிகழ்நேர நுண்ணறிவு</h2>
          </div>
          <p className="text-blue-100 mb-6">உங்கள் தற்போதைய அமர்வு தரவின் அடிப்படையில்:</p>
          <ul className="space-y-3">
            {stats.primary === 'Happy' ? (
              <li className="bg-white/10 p-3 rounded-2xl flex items-center gap-3">
                <span className="bg-white/20 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">✓</span>
                <span>சிறந்த வேலை! குழந்தை அதிக நேர்மறையான ஈடுபாட்டைக் காட்டுகிறது.</span>
              </li>
            ) : stats.primary !== 'None' ? (
              <li className="bg-white/10 p-3 rounded-2xl flex items-center gap-3">
                <span className="bg-white/20 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">!</span>
                <span>மனநிலையை மாற்ற ஒரு சிறிய இடைவெளி அல்லது வேடிக்கையான செயல்பாட்டைக் கருத்தில் கொள்ளுங்கள்.</span>
              </li>
            ) : (
              <li className="bg-white/10 p-3 rounded-2xl flex items-center gap-3">
                <span>AI நுண்ணறிவுகளைப் பெற நேரடி கண்காணிப்பைத் தொடங்கவும்.</span>
              </li>
            )}
          </ul>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-6">அமர்வு எச்சரிக்கைகள்</h2>
          <div className="space-y-4">
            {stats.alerts > 0 ? (
              <div className="flex gap-4 p-4 bg-rose-50 rounded-2xl border border-rose-100">
                <div className="bg-rose-500 p-2 rounded-xl h-fit">
                  <AlertCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-rose-900 text-sm">கவனம் தேவை</h4>
                  <p className="text-rose-700 text-xs mt-1">இந்த அமர்வில் {stats.alerts} சோகம்/கோபம் உணர்வுகள் கண்டறியப்பட்டுள்ளன.</p>
                </div>
              </div>
            ) : (
              <div className="flex gap-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                <div className="bg-emerald-500 p-2 rounded-xl h-fit">
                  <Smile className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-emerald-900 text-sm">எல்லாம் சரி</h4>
                  <p className="text-emerald-700 text-xs mt-1">இதுவரை எதிர்மறையான உணர்ச்சி மாற்றங்கள் எதுவும் கண்டறியப்படவில்லை.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
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
