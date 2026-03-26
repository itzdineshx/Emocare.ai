import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  BrainCircuit, 
  Volume2,
  VolumeX,
  MessageSquare,
  Smile,
  Frown,
  Meh,
  Zap,
  Hand,
  Activity,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { createEmotionEvent, getBackendSource } from '@/src/lib/api';
import { generateOpenRouterVisionJson, generateOpenRouterVisionText } from '@/src/lib/openrouter';

// Supported emotions
const EMOTIONS = ['Happy', 'Sad', 'Neutral', 'Angry', 'Surprised', 'Fearful', 'Disgusted'];

export default function LiveMonitor() {
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isZaraSpeaking, setIsZaraSpeaking] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState<string>('Neutral');
  const [currentGesture, setCurrentGesture] = useState<string>('None');
  const [confidence, setConfidence] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [zaraResponse, setZaraResponse] = useState('');
  const [zaraStatus, setZaraStatus] = useState<'Idle' | 'Listening' | 'Thinking' | 'Responding'>('Idle');
  const [isDetecting, setIsDetecting] = useState(false);
  const [lastDetectionTime, setLastDetectionTime] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef(''); // Use ref to get latest transcript in detection loop
  const sourceRef = useRef(getBackendSource());
  const monitorSessionIdRef = useRef(`monitor-${Date.now()}`);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true; // Keep listening for context
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        let fullTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          fullTranscript += event.results[i][0].transcript;
        }
        setTranscript(fullTranscript);
        transcriptRef.current = fullTranscript;
      };

      recognitionRef.current.onend = () => {
        if (isListening) {
          recognitionRef.current?.start(); // Restart if we're supposed to be listening
        }
      };
    }
  }, [isListening]);

  // Camera handling
  useEffect(() => {
    if (isCameraOn) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          if (videoRef.current) videoRef.current.srcObject = stream;
          setError(null);
        })
        .catch(err => {
          console.error("Error accessing camera:", err);
          setError("Error accessing camera: Permission denied. Please ensure camera access is allowed in your browser settings and try again.");
          setIsCameraOn(false);
        });
    } else {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    }
  }, [isCameraOn]);

  // Real Multimodal Detection Loop
  useEffect(() => {
    let interval: any;
    if (isCameraOn) {
      // Initial detection
      detectMultimodalEmotion();
      // Every 25 seconds to stay within free tier rate limits while being more responsive
      interval = setInterval(detectMultimodalEmotion, 25000); 
    }
    return () => clearInterval(interval);
  }, [isCameraOn]);

  const detectMultimodalEmotion = async () => {
    if (!isCameraOn || !videoRef.current || videoRef.current.videoWidth === 0 || isDetecting) return;

    // Rate limit protection for manual triggers
    const now = Date.now();
    if (now - lastDetectionTime < 15000) {
      console.log("Detection skipped: cooling down to respect rate limits.");
      return;
    }

    setIsDetecting(true);
    setError(null);
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      
      // Resize to a reasonable size for the API (max 512px for stability)
      const maxDim = 512;
      let width = video.videoWidth;
      let height = video.videoHeight;
      
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = (maxDim / width) * height;
          width = maxDim;
        } else {
          width = (maxDim / height) * width;
          height = maxDim;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.drawImage(video, 0, 0, width, height);
      const base64Image = canvas.toDataURL('image/jpeg', 0.4).split(',')[1];

      if (!base64Image || base64Image.length < 100) return; // Basic check for empty image

      const currentText = transcriptRef.current;

      const data = await generateOpenRouterVisionJson({
        base64Image,
        prompt: `You are an expert child psychologist and advanced multimodal emotion recognition AI.
Analyze this image and the child's recent speech: "${currentText}".

CRITICAL ANALYSIS GUIDELINES:
1. FACIAL MICRO-EXPRESSIONS: Look for subtle cues in the eyes (crinkling, widening), mouth (tightening, drooping), and brow (furrowing, raising).
2. BODY LANGUAGE & GESTURES: Analyze posture (slumped vs upright), hand positions (fidgeting, covering face), and overall body tension.
3. SPEECH CONTEXT: How does the child's voice/words match their appearance? Look for incongruence.
4. DEVELOPMENTAL CONTEXT: Interpret signals through the lens of child development.
5. CROSS-MODAL REASONING: Integrate all signals.

Return JSON with keys:
- reasoning (string)
- emotion (one of: Happy, Sad, Neutral, Angry, Surprised, Fearful, Disgusted)
- gesture (string)
- confidence (number from 0 to 100)
- zaraResponse (very short empathetic sentence under 15 words, English only)`
      });
      
      if (data.emotion && EMOTIONS.includes(data.emotion)) {
        setCurrentEmotion(data.emotion);
        setCurrentGesture(data.gesture || 'None');
        setConfidence(data.confidence || 90);
        
        await createEmotionEvent({
          source: sourceRef.current,
          idempotency_key: `${sourceRef.current}-${monitorSessionIdRef.current}-${Date.now()}`,
          session_id: monitorSessionIdRef.current,
          emotion: data.emotion,
          confidence: Number(data.confidence || 90),
          gesture: data.gesture || 'None',
          transcript: currentText || undefined,
          detected_at: new Date().toISOString(),
        });

        // Proactive Zara Response based on detected emotion
        if (data.zaraResponse && data.confidence > 60) {
          // Only speak if Zara isn't already speaking and the response is meaningful
          if (!isZaraSpeaking && data.emotion !== 'Neutral') {
            setZaraResponse(data.zaraResponse);
            setZaraStatus('Responding');
            speak(data.zaraResponse);
          } else if (data.emotion === 'Neutral') {
            // Just update the text if it's neutral, don't interrupt with voice unless it's a specific interaction
            setZaraResponse(data.zaraResponse);
          }
        }
      }
      setLastDetectionTime(Date.now());
    } catch (error: any) {
      console.error("Multimodal detection error:", error);
      if (error?.message?.includes('429') || error?.status === 'RESOURCE_EXHAUSTED') {
        setError("Rate limit reached. Detection will resume shortly.");
      } else {
        setError("Detection error. Please try again.");
      }
    } finally {
      setIsDetecting(false);
    }
  };

  const toggleCamera = () => setIsCameraOn(!isCameraOn);
  
  const toggleListening = () => {
    if (!isListening) {
      setTranscript('');
      transcriptRef.current = '';
      setZaraStatus('Listening');
      recognitionRef.current?.start();
    } else {
      recognitionRef.current?.stop();
      handleProcessVoice(); // Process when stopping
    }
    setIsListening(!isListening);
  };

  const handleProcessVoice = async () => {
    if (!transcriptRef.current && !isCameraOn) {
      setIsListening(false);
      setZaraStatus('Idle');
      return;
    }

    setZaraStatus('Thinking');
    
    try {
      let imagePart = null;
      if (isCameraOn && videoRef.current) {
        const canvas = document.createElement('canvas');
        const maxDim = 512;
        let width = videoRef.current.videoWidth;
        let height = videoRef.current.videoHeight;
        
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = (maxDim / width) * height;
            width = maxDim;
          } else {
            width = (maxDim / height) * width;
            height = maxDim;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, width, height);
          const base64Image = canvas.toDataURL('image/jpeg', 0.4).split(',')[1];
          imagePart = { inlineData: { data: base64Image, mimeType: "image/jpeg" } };
        }
      }

      const prompt = `You are Zara, a very soft, gentle, and empathetic AI friend for children. 
        Your voice and tone should be like a kind preschool teacher or a warm, fuzzy teddy bear.
        
        CONTEXT:
        - Child's Detected Emotion: ${currentEmotion}
        - Child's Current Gesture: ${currentGesture}
        - Child said: "${transcriptRef.current}"
        
        INSTRUCTIONS:
        1. Be extra gentle and soft. Use words like "friend", "sweetie", or "buddy" where appropriate.
        2. If they look Sad, be very comforting and ask "Are you okay, friend?".
        3. If they are Happy, share their joy with a soft, cheerful tone.
        4. Keep responses short, simple, and very encouraging.
        5. Always prioritize making the child feel safe and loved.
        6. Acknowledge their gesture if it's meaningful (like waving).
        7. Respond ONLY in English.`;

      const text = await generateOpenRouterVisionText({
        prompt,
        base64Image: imagePart?.inlineData.data,
      });
      setZaraResponse(text);
      setZaraStatus('Responding');
      speak(text);
    } catch (error) {
      console.error("AI Error:", error);
      setZaraStatus('Idle');
    }
  };

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      
      const doSpeak = () => {
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        const childVoice = voices.find(v => v.name.includes('Google') || v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Natural'));
        
        if (childVoice) utterance.voice = childVoice;
        utterance.pitch = 1.3;
        utterance.rate = 0.9;
        utterance.volume = 0.9;
        
        utterance.onstart = () => setIsZaraSpeaking(true);
        utterance.onend = () => {
          setIsZaraSpeaking(false);
          setZaraStatus('Idle');
        };
        utterance.onerror = (e) => {
          console.error("Speech error:", e);
          setIsZaraSpeaking(false);
          setZaraStatus('Idle');
        };
        
        window.speechSynthesis.speak(utterance);
      };

      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = doSpeak;
      } else {
        doSpeak();
      }
    }
  };

  const getEmotionIcon = (emotion: string) => {
    switch (emotion) {
      case 'Happy': return <Smile className="text-blue-500" />;
      case 'Sad': return <Frown className="text-rose-500" />;
      case 'Angry': return <Zap className="text-amber-500" />;
      default: return <Meh className="text-slate-500" />;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-12rem)]">
      {/* Left Side: Video Feed */}
      <div className="flex flex-col gap-6">
        <div className="relative flex-1 bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white">
          {isCameraOn ? (
            <video 
              ref={videoRef} 
              autoPlay 
              muted 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-4">
              <VideoOff className="w-16 h-16 opacity-20" />
              <p className="font-medium">Camera is off</p>
            </div>
          )}

          {/* Overlays */}
          <AnimatePresence>
            {isCameraOn && (
              <>
                {/* Error Message */}
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-red-500/90 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg flex items-center gap-3"
                  >
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {error}
                    </div>
                    <button 
                      onClick={() => detectMultimodalEmotion()}
                      className="bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded-md transition-colors border border-white/20"
                    >
                      Retry
                    </button>
                  </motion.div>
                )}

                {/* Detection Status */}
                {isDetecting && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute top-4 right-4 z-20 bg-blue-600/90 text-white px-3 py-1.5 rounded-full text-[10px] font-bold shadow-lg flex items-center gap-2 uppercase tracking-widest"
                  >
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    Analyzing...
                  </motion.div>
                )}

                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute top-6 left-6 flex flex-col gap-3"
                >
                  <div className="bg-white/90 backdrop-blur-md p-4 rounded-3xl flex items-center gap-3 shadow-lg">
                    <div className="bg-blue-100 p-2 rounded-2xl">
                      {getEmotionIcon(currentEmotion)}
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Emotion</p>
                      <p className="text-lg font-bold text-slate-800">{currentEmotion}</p>
                    </div>
                  </div>

                  <div className="bg-white/90 backdrop-blur-md p-4 rounded-3xl flex items-center gap-3 shadow-lg">
                    <div className="bg-purple-100 p-2 rounded-2xl">
                      <Hand className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Gesture</p>
                      <p className="text-lg font-bold text-slate-800">{currentGesture}</p>
                    </div>
                  </div>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="absolute top-6 right-6 bg-blue-600/90 backdrop-blur-md px-4 py-2 rounded-full text-white text-sm font-bold shadow-lg flex items-center gap-2"
                >
                  <Activity className="w-4 h-4" />
                  {confidence}% Accuracy
                </motion.div>

                {/* Face Box */}
                <motion.div 
                  animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 border-2 border-blue-400/50 rounded-[3rem] border-dashed"
                />
              </>
            )}
          </AnimatePresence>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4">
            <button 
              onClick={toggleCamera}
              className={cn(
                "p-4 rounded-2xl transition-all duration-300 shadow-xl",
                isCameraOn ? "bg-white text-slate-900" : "bg-blue-600 text-white"
              )}
            >
              {isCameraOn ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Right Side: Interaction */}
      <div className="flex flex-col gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex-1 flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-3 rounded-2xl transition-colors",
                zaraStatus === 'Idle' ? "bg-slate-100 text-slate-400" : "bg-blue-600 text-white"
              )}>
                <BrainCircuit className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Multimodal Zara</h3>
                <p className="text-xs text-slate-500 font-medium">Analyzing Vision + Voice + Gestures</p>
              </div>
            </div>
            {isCameraOn && (
              <button 
                onClick={detectMultimodalEmotion}
                disabled={isDetecting}
                className={cn(
                  "p-3 rounded-2xl transition-all border shadow-sm flex items-center gap-2 text-xs font-bold",
                  isDetecting
                    ? "bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed"
                    : "bg-white text-blue-600 border-blue-100 hover:bg-blue-50"
                )}
              >
                <BrainCircuit className={cn("w-4 h-4", isDetecting && "animate-spin")} />
                {isDetecting ? 'Analyzing...' : 'Refresh'}
              </button>
            )}
          </div>

          <div className="flex-1 flex flex-col gap-6">
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                <Mic className="w-3 h-3" /> Audio Context
              </p>
              <p className={cn(
                "text-lg font-medium",
                transcript ? "text-slate-800" : "text-slate-300 italic"
              )}>
                {transcript || "Listening for voice context..."}
              </p>
            </div>

            <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 flex-1">
              <p className="text-xs text-blue-400 font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                <MessageSquare className="w-3 h-3" /> Zara's Insight
              </p>
              <p className={cn(
                "text-lg font-medium",
                zaraResponse ? "text-blue-800" : "text-blue-200 italic"
              )}>
                {zaraResponse || "Zara is observing and listening..."}
              </p>
            </div>
          </div>

          <div className="mt-8 flex justify-center">
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={toggleListening}
              className={cn(
                "px-8 py-4 rounded-2xl font-bold flex items-center gap-3 transition-all duration-300 shadow-xl",
                isListening 
                  ? "bg-rose-500 text-white shadow-rose-200" 
                  : "bg-blue-600 text-white shadow-blue-200"
              )}
            >
              {isListening ? (
                <>
                  <MicOff className="w-6 h-6" />
                  Stop Listening
                </>
              ) : (
                <>
                  <Mic className="w-6 h-6" />
                  Start Conversation
                </>
              )}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
