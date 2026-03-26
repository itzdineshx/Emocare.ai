import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Mic, 
  MicOff, 
  BrainCircuit, 
  User,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { GoogleGenAI } from "@google/genai";
import { retryAI } from "@/src/lib/ai-retry";

interface Message {
  id: string;
  role: 'user' | 'zara';
  text: string;
  timestamp: Date;
}

export default function AICompanion() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'zara',
      text: "Hi there! I'm Zara, your AI friend. How are you feeling today?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Speech Recognition Setup
  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      
      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        handleSendMessage(transcript);
      };

      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  const handleSendMessage = async (text: string = input) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsThinking(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      
      // Get latest emotion context
      const sessionData = JSON.parse(sessionStorage.getItem('emotion_history') || '[]');
      const latestEmotion = sessionData.length > 0 ? sessionData[sessionData.length - 1].emotion : 'Neutral';
      const latestGesture = sessionData.length > 0 ? sessionData[sessionData.length - 1].gesture : 'None';

      const response = await retryAI(async () => {
        return await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `You are Zara, a very soft, gentle, and empathetic AI friend for children. 
          Your voice and tone should be like a kind preschool teacher or a warm, fuzzy teddy bear.
          
          CURRENT CONTEXT:
          - Child's Detected Emotion: ${latestEmotion}
          - Child's Current Gesture: ${latestGesture}
          - Child said: "${text}"
          
          INSTRUCTIONS:
          1. Be extra gentle and soft. Use words like "friend", "sweetie", or "buddy" where appropriate.
          2. If they look Sad, be very comforting and ask "Are you okay, friend?".
          3. If they are Happy, share their joy with a soft, cheerful tone.
          4. Keep responses short, simple, and very encouraging.
          5. Always prioritize making the child feel safe and loved.
          6. Respond ONLY in English.`,
        });
      });

      const zaraMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'zara',
        text: response.text || "That's interesting! Tell me more.",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, zaraMessage]);
      speak(zaraMessage.text);
    } catch (error: any) {
      console.error("AI Error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'zara',
        text: error?.message?.includes('429') 
          ? "I'm a little tired right now! Let's take a short break and talk again in a minute." 
          : "I'm having a little trouble thinking. Can you say that again?",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsThinking(false);
    }
  };

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Select a softer, more child-friendly voice if available
      const voices = window.speechSynthesis.getVoices();
      const childVoice = voices.find(v => v.name.includes('Google') || v.name.includes('Female') || v.name.includes('Samantha'));
      if (childVoice) utterance.voice = childVoice;

      utterance.pitch = 1.3; // Slightly higher but soft
      utterance.rate = 0.9;  // Slightly slower for a gentle feel
      utterance.volume = 0.8; // Not too loud
      
      window.speechSynthesis.speak(utterance);
    }
  };

  const toggleListening = () => {
    if (!isListening) {
      recognitionRef.current?.start();
      setIsListening(true);
    } else {
      recognitionRef.current?.stop();
      setIsListening(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-12rem)] flex flex-col bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
      {/* Chat Header */}
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-blue-50/50">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-2xl">
            <BrainCircuit className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Chat with Zara</h3>
            <p className="text-xs text-blue-600 font-medium">Always here to help</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-white px-3 py-1 rounded-full shadow-sm">
          <Sparkles className="w-3 h-3 text-blue-500" />
          AI POWERED
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-8 space-y-6 scroll-smooth"
      >
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex gap-4 max-w-[80%]",
              msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
            )}
          >
            <div className={cn(
              "w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm",
              msg.role === 'zara' ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
            )}>
              {msg.role === 'zara' ? <BrainCircuit className="w-5 h-5" /> : <User className="w-5 h-5" />}
            </div>
            <div className={cn(
              "p-5 rounded-3xl text-sm leading-relaxed",
              msg.role === 'zara' 
                ? "bg-blue-50 text-blue-900 rounded-tl-none" 
                : "bg-slate-100 text-slate-900 rounded-tr-none"
            )}>
              {msg.text}
            </div>
          </motion.div>
        ))}
        {isThinking && (
          <div className="flex gap-4 max-w-[80%]">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div className="bg-blue-50 p-5 rounded-3xl rounded-tl-none flex gap-1">
              <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1 }} className="w-2 h-2 bg-blue-400 rounded-full" />
              <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-2 h-2 bg-blue-400 rounded-full" />
              <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-2 h-2 bg-blue-400 rounded-full" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-6 border-t border-slate-100 bg-slate-50/50">
        <div className="flex gap-3">
          <button 
            onClick={toggleListening}
            className={cn(
              "p-4 rounded-2xl transition-all duration-300",
              isListening ? "bg-rose-500 text-white shadow-lg shadow-rose-200" : "bg-white text-slate-400 border border-slate-200 hover:text-blue-600"
            )}
          >
            {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>
          <input 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type a message for Zara..."
            className="flex-1 bg-white border border-slate-200 rounded-2xl px-6 py-4 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
          <button 
            onClick={() => handleSendMessage()}
            disabled={!input.trim()}
            className="bg-blue-600 text-white p-4 rounded-2xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-200"
          >
            <Send className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
