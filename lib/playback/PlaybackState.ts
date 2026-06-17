import type { PlaybackEvent } from './PlaybackEvent';

export interface PlaybackState {
  events: PlaybackEvent[];
  index: number;
  speed: 0.5 | 1 | 2;
  slowMode: boolean;
  status: 'idle' | 'playing' | 'paused' | 'completed' | 'blocked';
}
