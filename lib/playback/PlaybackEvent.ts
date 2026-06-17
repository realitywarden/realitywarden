import type { ActionFrame } from '@/lib/action-runtime/ActionFrame';

export interface PlaybackEvent {
  event_id: string;
  command_id: string;
  frame?: ActionFrame;
  timeline_ms: number;
  status: 'ready' | 'running' | 'paused' | 'completed' | 'blocked';
  message?: string;
}
