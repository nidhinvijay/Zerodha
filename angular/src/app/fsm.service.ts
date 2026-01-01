import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, combineLatest, map } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { InstrumentService } from './instrument.service';

export type FsmState = 'NOSIGNAL' | 'NOPOSITION_SIGNAL' | 'BUYPOSITION' | 'NOPOSITION_BLOCKED';

export interface StateLogEntry {
  timestamp: string;
  event: string;
  state: FsmState;
  ltp: number | null;
  threshold: number | null;
}

export interface FsmSnapshot {
  token: number;
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
  private instrumentService = inject(InstrumentService);
  private socket: Socket;
  
  private fsmMap = new Map<number, FsmSnapshot>(); // token -> fsm
  private fsmSubject = new BehaviorSubject<Map<number, FsmSnapshot>>(new Map());

  // Observable that emits only the selected instrument's FSM
  readonly fsm$ = combineLatest([
    this.fsmSubject,
    this.instrumentService.selectedToken$
  ]).pipe(
    map(([fsms, token]) => token ? fsms.get(token) || null : null)
  );

  constructor() {
    const serverUrl = location.hostname === 'localhost' 
      ? 'http://localhost:3004' 
      : location.origin;
    
    this.socket = io(serverUrl);
    
    // Receive FSM state from backend
    this.socket.on('fsm', (snapshot: FsmSnapshot) => {
      if (snapshot.token) {
        this.fsmMap.set(snapshot.token, snapshot);
        this.fsmSubject.next(new Map(this.fsmMap));
      }
    });
    
    this.socket.on('connect', () => console.log('FSM service connected'));
  }
}
