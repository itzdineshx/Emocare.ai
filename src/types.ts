export type Emotion = 'Happy' | 'Sad' | 'Angry' | 'Neutral' | 'Surprised';

export interface EmotionData {
  timestamp: string;
  emotion: Emotion;
  confidence: number;
}

export interface Message {
  id: string;
  role: 'user' | 'zara';
  text: string;
  emotion?: Emotion;
  timestamp: Date;
}
