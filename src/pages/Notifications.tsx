import React from 'react';
import { Bell, AlertTriangle, Info, CheckCircle2, Clock } from 'lucide-react';
import { motion } from 'motion/react';

const notifications = [
  {
    id: 1,
    type: 'alert',
    title: 'அதிக சோகம் கண்டறியப்பட்டது',
    message: 'குழந்தை காலை 11:15 மணிக்கு நீண்ட நேரம் சோகமாக இருந்தது. சாரா ஆறுதல் பயன்முறையைத் தொடங்கியது.',
    time: '2 மணி நேரத்திற்கு முன்பு',
    icon: AlertTriangle,
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-100'
  },
  {
    id: 2,
    type: 'info',
    title: 'இன்று குறைந்த ஈடுபாடு',
    message: 'ஈடுபாட்டின் அளவுகள் நேற்றைய சராசரியை விட 15% குறைவாக உள்ளன.',
    time: '4 மணி நேரத்திற்கு முன்பு',
    icon: Info,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-100'
  },
  {
    id: 3,
    type: 'success',
    title: 'நேர்மறையான முன்னேற்றம்',
    message: 'கடந்த வாரத்துடன் ஒப்பிடும்போது இந்த வாரம் குழந்தை 20% கூடுதல் "மகிழ்ச்சி" உணர்வுகளைக் காட்டியுள்ளது.',
    time: '1 நாளைக்கு முன்பு',
    icon: CheckCircle2,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-100'
  },
  {
    id: 4,
    type: 'info',
    title: 'புதிய செயல்பாட்டு பரிந்துரை',
    message: 'தற்போதைய மனநிலையின் அடிப்படையில் சாரா ஒரு ஆக்கபூர்வமான வரைதல் அமர்வைப் பரிந்துரைத்தது.',
    time: '1 நாளைக்கு முன்பு',
    icon: Bell,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-100'
  }
];

export default function Notifications() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold text-slate-800">அறிவிப்புகள்</h2>
        <button className="text-sm text-blue-600 font-medium hover:underline">அனைத்தையும் படித்ததாகக் குறிக்கவும்</button>
      </div>

      <div className="space-y-4">
        {notifications.map((notif, index) => (
          <motion.div
            key={notif.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`p-6 rounded-3xl border ${notif.bg} ${notif.border} flex gap-5`}
          >
            <div className={`p-3 rounded-2xl bg-white h-fit shadow-sm ${notif.color}`}>
              <notif.icon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start mb-1">
                <h4 className="font-bold text-slate-900">{notif.title}</h4>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {notif.time}
                </span>
              </div>
              <p className="text-slate-600 text-sm leading-relaxed">{notif.message}</p>
              <div className="mt-4 flex gap-3">
                <button className="text-xs font-bold px-4 py-2 bg-white rounded-xl shadow-sm hover:bg-slate-50 transition-colors">
                  விவரங்களைக் காண்க
                </button>
                <button className="text-xs font-bold px-4 py-2 text-slate-400 hover:text-slate-600 transition-colors">
                  நீக்கு
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
