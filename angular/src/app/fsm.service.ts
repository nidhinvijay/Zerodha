import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, combineLatest, map } from 'rxjs';
import { SocketService } from './socket.service';
import { InstrumentService } from './instrument.service';

export type FsmState = 'NOSIGNAL' | 'NOPOSITION_SIGNAL' | 'BUYPOSITION' | 'NOPOSITION_BLOCKED';

export interface StateLogEntry {
  timestamp: string;
  event: string;
  state: FsmState;
  ltp: number | null;
  threshold: number | null;
}

export interface Trade {
  entry: number;
  exit: number;
  pnl: number;
  lot: number;
  reason: string;
  timestamp: string;
  entryTime?: string;
  exitTime?: string;
}

export interface FsmSnapshot {
  token: number;
  symbol: string | null;
  ltp: number | null;
  threshold: number | null;
  state: FsmState;
  blockedAtMs: number | null;
  lastCheckedAtMs: number | null;
  
  // Paper trading
  entryPrice: number | null;
  lot: number;
  unrealizedPnL: number;
  realizedPnL: number;
  cumPnL: number;
  paperTrades: Trade[];
  
  // Live trading
  liveActive: boolean;
  liveEntryPrice: number | null;
  liveUnrealizedPnL: number;
  liveRealizedPnL: number;
  liveCumPnL: number;
  liveTrades: Trade[];
  
  stateLog: StateLogEntry[];
}

@Injectable({ providedIn: 'root' })
export class FsmService {
  private socketService = inject(SocketService);
  private instrumentService = inject(InstrumentService);
  
  private fsmMap = new Map<number, FsmSnapshot>();
  private fsmSubject = new BehaviorSubject<Map<number, FsmSnapshot>>(new Map());

  readonly fsm$ = combineLatest([
    this.fsmSubject,
    this.instrumentService.selectedToken$
  ]).pipe(
    map(([fsms, token]) => token ? fsms.get(token) || null : null)
  );

  constructor() {
    const socket = this.socketService.socket;
    
    socket.on('fsm', (snapshot: FsmSnapshot) => {
      if (snapshot.token) {
        this.fsmMap.set(snapshot.token, snapshot);
        this.fsmSubject.next(new Map(this.fsmMap));
      }
    });
  }
}
