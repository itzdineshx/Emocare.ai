import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { Calendar, Download, Filter } from 'lucide-react';

const weeklyData = [
  { day: 'திங்கள்', happy: 70, sad: 10, angry: 20 },
  { day: 'செவ்வாய்', happy: 80, sad: 5, angry: 15 },
  { day: 'புதன்', happy: 65, sad: 20, angry: 15 },
  { day: 'வியாழன்', happy: 90, sad: 5, angry: 5 },
  { day: 'வெள்ளி', happy: 75, sad: 15, angry: 10 },
  { day: 'சனி', happy: 85, sad: 10, angry: 5 },
  { day: 'ஞாயிறு', happy: 95, sad: 2, angry: 3 },
];

export default function Insights() {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">உணர்ச்சி நுண்ணறிவு</h2>
          <p className="text-slate-500">நீண்ட கால உணர்ச்சி முறைகளை ஆழமாக ஆராயுங்கள்</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white border border-slate-200 p-2 rounded-xl text-slate-600 hover:bg-slate-50">
            <Calendar className="w-5 h-5" />
          </button>
          <button className="bg-white border border-slate-200 p-2 rounded-xl text-slate-600 hover:bg-slate-50">
            <Filter className="w-5 h-5" />
          </button>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2">
            <Download className="w-4 h-4" />
            தரவை ஏற்றுமதி செய்
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Weekly Distribution */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-8">வாராந்திர உணர்ச்சி விநியோகம்</h3>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 12}} />
                <Tooltip 
                  cursor={{fill: '#F8FAFC'}}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="happy" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sad" fill="#F43F5E" radius={[4, 4, 0, 0]} />
                <Bar dataKey="angry" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Engagement Level */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-8">காலப்போக்கில் ஈடுபாட்டின் நிலை</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyData}>
                <defs>
                  <linearGradient id="colorEngage" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="happy" stroke="#3B82F6" fillOpacity={1} fill="url(#colorEngage)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
