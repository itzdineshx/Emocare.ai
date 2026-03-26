import React from 'react';
import { 
  Bell, 
  Shield, 
  Globe, 
  Volume2, 
  Eye, 
  Database,
  ChevronRight
} from 'lucide-react';

const SettingItem = ({ icon: Icon, title, description, toggle }: any) => (
  <div className="flex items-center justify-between p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
    <div className="flex items-center gap-4">
      <div className="p-3 bg-slate-50 rounded-2xl text-slate-500">
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <h4 className="font-bold text-slate-900">{title}</h4>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
    </div>
    {toggle ? (
      <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" className="sr-only peer" defaultChecked={toggle === 'on'} />
        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
      </label>
    ) : (
      <ChevronRight className="w-5 h-5 text-slate-300" />
    )}
  </div>
);

export default function Settings() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <section className="space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">பொதுவானவை</h3>
        <div className="space-y-3">
          <SettingItem 
            icon={Bell} 
            title="அறிவிப்புகள்" 
            description="உணர்ச்சி மாற்றங்களுக்கான எச்சரிக்கைகளைப் பெறுங்கள்" 
            toggle="on"
          />
          <SettingItem 
            icon={Volume2} 
            title="சாரா குரல்" 
            description="சாராவிற்கு உரையிலிருந்து பேச்சு வசதியை இயக்கவும்" 
            toggle="on"
          />
          <SettingItem 
            icon={Globe} 
            title="மொழி" 
            description="கணினி மொழி தேர்வு" 
          />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">தனியுரிமை மற்றும் பாதுகாப்பு</h3>
        <div className="space-y-3">
          <SettingItem 
            icon={Shield} 
            title="தனியுரிமை பயன்முறை" 
            description="செயலில் இல்லாதபோது வீடியோ ஊட்டத்தை மங்கலாக்கு" 
            toggle="off"
          />
          <SettingItem 
            icon={Database} 
            title="தரவு சேமிப்பு" 
            description="30 நாட்களுக்கு உணர்ச்சி வரலாற்றை வைத்திருங்கள்" 
            toggle="on"
          />
          <SettingItem 
            icon={Eye} 
            title="பெற்றோர் கட்டுப்பாடுகள்" 
            description="அணுகல் மற்றும் கட்டுப்பாடுகளை நிர்வகிக்கவும்" 
          />
        </div>
      </section>

      <div className="pt-8">
        <button className="w-full py-4 bg-rose-50 text-rose-600 font-bold rounded-2xl border border-rose-100 hover:bg-rose-100 transition-colors">
          அனைத்து தரவையும் மீட்டமை
        </button>
      </div>
    </div>
  );
}
