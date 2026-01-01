import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { io, Socket } from 'socket.io-client';

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
  private socket: Socket;
  private tickSubject = new BehaviorSubject<Tick | null>(null);
  readonly tick$ = this.tickSubject.asObservable();

  constructor() {
    // Use same origin in production, localhost for dev
    const serverUrl = location.hostname === 'localhost' 
      ? 'http://localhost:3004' 
      : location.origin;
    
    this.socket = io(serverUrl);
    this.socket.on('tick', (tick: Tick) => this.tickSubject.next(tick));
    this.socket.on('connect', () => console.log('Connected to server'));
    this.socket.on('disconnect', () => console.log('Disconnected'));
  }
}
