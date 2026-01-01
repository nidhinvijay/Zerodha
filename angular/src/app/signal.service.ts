import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, combineLatest, map } from 'rxjs';
import { io, Socket } from 'socket.io-client';
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
  private instrumentService = inject(InstrumentService);
  private socket: Socket;
  
  private signalsMap = new Map<number, Signal[]>(); // token -> signals
  private signalsSubject = new BehaviorSubject<Map<number, Signal[]>>(new Map());

  // Observable that emits only the selected instrument's signals
  readonly signals$ = combineLatest([
    this.signalsSubject,
    this.instrumentService.selectedToken$
  ]).pipe(
    map(([signals, token]) => token ? signals.get(token) || [] : [])
  );

  constructor() {
    const serverUrl = location.hostname === 'localhost' 
      ? 'http://localhost:3004' 
      : location.origin;
    
    this.socket = io(serverUrl);
    
    // Receive new signal
    this.socket.on('signal', (signal: Signal) => {
      const current = this.signalsMap.get(signal.token) || [];
      this.signalsMap.set(signal.token, [signal, ...current].slice(0, 100));
      this.signalsSubject.next(new Map(this.signalsMap));
    });
    
    // Receive signal history for selected instrument
    this.socket.on('signals', (history: Signal[]) => {
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
