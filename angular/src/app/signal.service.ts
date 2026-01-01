import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, combineLatest, map } from 'rxjs';
import { SocketService } from './socket.service';
import { InstrumentService } from './instrument.service';

export interface Signal {
  symbol: string;
  token: number;
  zerodha: string;
  intent: string;
  stoppx: number | null;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class SignalService {
  private socketService = inject(SocketService);
  private instrumentService = inject(InstrumentService);
  
  private signalsMap = new Map<number, Signal[]>();
  private signalsSubject = new BehaviorSubject<Map<number, Signal[]>>(new Map());

  readonly signals$ = combineLatest([
    this.signalsSubject,
    this.instrumentService.selectedToken$
  ]).pipe(
    map(([signals, token]) => token ? signals.get(token) || [] : [])
  );

  constructor() {
    const socket = this.socketService.socket;
    
    // Receive new signal
    socket.on('signal', (signal: Signal) => {
      const current = this.signalsMap.get(signal.token) || [];
      this.signalsMap.set(signal.token, [signal, ...current].slice(0, 100));
      this.signalsSubject.next(new Map(this.signalsMap));
    });
    
    // Receive signal history for selected instrument
    socket.on('signals', (history: Signal[]) => {
      if (history.length > 0) {
        const token = history[0].token;
        this.signalsMap.set(token, history);
        this.signalsSubject.next(new Map(this.signalsMap));
      }
    });
  }

  clearSignals() {
    const token = this.instrumentService.getSelectedToken();
    if (token) {
      this.signalsMap.set(token, []);
      this.signalsSubject.next(new Map(this.signalsMap));
    }
  }
}
