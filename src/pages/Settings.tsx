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
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">General</h3>
        <div className="space-y-3">
          <SettingItem 
            icon={Bell} 
            title="Notifications" 
            description="Receive alerts for emotional changes" 
            toggle="on"
          />
          <SettingItem 
            icon={Volume2} 
            title="Zara Voice" 
            description="Enable text-to-speech for Zara" 
            toggle="on"
          />
          <SettingItem 
            icon={Globe} 
            title="Language" 
            description="English (Default)" 
          />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">Privacy & Security</h3>
        <div className="space-y-3">
          <SettingItem 
            icon={Shield} 
            title="Privacy Mode" 
            description="Blur video feed when not active" 
            toggle="off"
          />
          <SettingItem 
            icon={Database} 
            title="Data Storage" 
            description="Keep emotion history for 30 days" 
            toggle="on"
          />
          <SettingItem 
            icon={Eye} 
            title="Parental Controls" 
            description="Manage access and restrictions" 
          />
        </div>
      </section>

      <div className="pt-8">
        <button className="w-full py-4 bg-rose-50 text-rose-600 font-bold rounded-2xl border border-rose-100 hover:bg-rose-100 transition-colors">
          Reset All Data
        </button>
      </div>
    </div>
  );
}
