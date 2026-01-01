import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, combineLatest, map } from 'rxjs';
import { SocketService } from './socket.service';
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
  private socketService = inject(SocketService);
  private instrumentService = inject(InstrumentService);
  
  private ticksMap = new Map<number, Tick>();
  private ticksSubject = new BehaviorSubject<Map<number, Tick>>(new Map());

  readonly tick$ = combineLatest([
    this.ticksSubject,
    this.instrumentService.selectedToken$
  ]).pipe(
    map(([ticks, token]) => token ? ticks.get(token) || null : null)
  );

  constructor() {
    const socket = this.socketService.socket;
    
    socket.on('tick', (tick: Tick) => {
      this.ticksMap.set(tick.token, tick);
      this.ticksSubject.next(new Map(this.ticksMap));
    });
  }
}
