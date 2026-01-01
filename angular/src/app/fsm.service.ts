import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { io, Socket } from 'socket.io-client';

export type FsmState = 'NOSIGNAL' | 'NOPOSITION_SIGNAL' | 'BUYPOSITION' | 'NOPOSITION_BLOCKED';

export interface StateLogEntry {
  timestamp: string;
  event: string;
  state: FsmState;
  ltp: number | null;
  threshold: number | null;
}

export interface FsmSnapshot {
  symbol: string | null;
  ltp: number | null;
  threshold: number | null;
  state: FsmState;
  blockedAtMs: number | null;
  lastCheckedAtMs: number | null;
  entryPrice: number | null;
  stateLog: StateLogEntry[];
}

@Injectable({ providedIn: 'root' })
export class FsmService {
  private socket: Socket;
  private fsmSubject = new BehaviorSubject<FsmSnapshot>({
    symbol: null,
    ltp: null,
    threshold: null,
    state: 'NOSIGNAL',
    blockedAtMs: null,
    lastCheckedAtMs: null,
    entryPrice: null,
    stateLog: []
  });
  readonly fsm$ = this.fsmSubject.asObservable();

  constructor() {
    const serverUrl = location.hostname === 'localhost' 
      ? 'http://localhost:3004' 
      : location.origin;
    
    this.socket = io(serverUrl);
    
    // Receive FSM state from backend
    this.socket.on('fsm', (snapshot: FsmSnapshot) => {
      this.fsmSubject.next(snapshot);
    });
    
    this.socket.on('connect', () => console.log('FSM service connected'));
  }
}
