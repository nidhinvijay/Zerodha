import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { io, Socket } from 'socket.io-client';

export interface Signal {
  symbol: string;
  intent: string;
  stoppx: number | null;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class SignalService {
  private socket: Socket;
  private signalsSubject = new BehaviorSubject<Signal[]>([]);
  readonly signals$ = this.signalsSubject.asObservable();

  constructor() {
    const serverUrl = location.hostname === 'localhost' 
      ? 'http://localhost:3004' 
      : location.origin;
    
    this.socket = io(serverUrl);
    
    this.socket.on('signal', (signal: Signal) => {
      const current = this.signalsSubject.value;
      this.signalsSubject.next([signal, ...current].slice(0, 20)); // Keep last 20
    });
  }

  clearSignals() {
    this.signalsSubject.next([]);
  }
}
