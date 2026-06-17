import type { PlaybackEvent } from './PlaybackEvent';
import type { PlaybackState } from './PlaybackState';

export class PlaybackController {
  state: PlaybackState;

  constructor(events: PlaybackEvent[] = [], slowMode = false) {
    this.state = {
      events: slowMode ? enforceSlowMode(events) : events,
      index: 0,
      speed: 1,
      slowMode,
      status: events.some((event) => event.status === 'blocked') ? 'blocked' : 'idle'
    };
  }

  play() {
    if (this.state.status !== 'blocked') this.state.status = 'playing';
    return this.state;
  }

  pause() {
    if (this.state.status === 'playing') this.state.status = 'paused';
    return this.state;
  }

  stepNext() {
    this.state.index = Math.min(this.state.events.length - 1, this.state.index + 1);
    this.state.status = this.state.index >= this.state.events.length - 1 ? 'completed' : 'paused';
    return this.state;
  }

  stepPrev() {
    this.state.index = Math.max(0, this.state.index - 1);
    this.state.status = 'paused';
    return this.state;
  }

  replay() {
    this.state.index = 0;
    this.state.status = this.state.events.some((event) => event.status === 'blocked') ? 'blocked' : 'playing';
    return this.state;
  }

  setSpeed(speed: 0.5 | 1 | 2) {
    this.state.speed = speed;
    return this.state;
  }
}

function enforceSlowMode(events: PlaybackEvent[]) {
  if (events.length === 0) return events;
  const duration = Math.max(1500, events[events.length - 1].timeline_ms);
  return events.map((event, index) => ({
    ...event,
    timeline_ms: Math.round((duration * index) / Math.max(1, events.length - 1))
  }));
}
