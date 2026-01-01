import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, combineLatest, map } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { InstrumentService } from './instrument.service';

export interface Tick {
  symbol: string;
  token: number;
  ltp: number;
  change: number;
  volume: number;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class TickService {
  private instrumentService = inject(InstrumentService);
  private socket: Socket;
  
  private ticksMap = new Map<number, Tick>(); // token -> tick
  private ticksSubject = new BehaviorSubject<Map<number, Tick>>(new Map());

  // Observable that emits only the selected instrument's tick
  readonly tick$ = combineLatest([
    this.ticksSubject,
    this.instrumentService.selectedToken$
  ]).pipe(
    map(([ticks, token]) => token ? ticks.get(token) || null : null)
  );

  constructor() {
    const serverUrl = location.hostname === 'localhost' 
      ? 'http://localhost:3004' 
      : location.origin;
    
    this.socket = io(serverUrl);
    
    this.socket.on('tick', (tick: Tick) => {
      this.ticksMap.set(tick.token, tick);
      this.ticksSubject.next(new Map(this.ticksMap));
    });
    
    this.socket.on('connect', () => console.log('Tick service connected'));
  }
}
