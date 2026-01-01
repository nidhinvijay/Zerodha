import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { io, Socket } from 'socket.io-client';

export interface Instrument {
  tradingview: string;
  exchange: string;
  zerodha: string;
  token: number;
  lot: number;
}

@Injectable({ providedIn: 'root' })
export class InstrumentService {
  private socket: Socket;
  
  private instrumentsSubject = new BehaviorSubject<Instrument[]>([]);
  readonly instruments$ = this.instrumentsSubject.asObservable();
  
  private selectedTokenSubject = new BehaviorSubject<number | null>(null);
  readonly selectedToken$ = this.selectedTokenSubject.asObservable();

  constructor() {
    const serverUrl = location.hostname === 'localhost' 
      ? 'http://localhost:3004' 
      : location.origin;
    
    this.socket = io(serverUrl);
    
    // Receive instruments list on connect
    this.socket.on('instruments', (list: Instrument[]) => {
      this.instrumentsSubject.next(list);
      // Auto-select first instrument
      if (list.length > 0 && !this.selectedTokenSubject.value) {
        this.selectInstrument(list[0].token);
      }
    });
  }

  selectInstrument(token: number) {
    this.selectedTokenSubject.next(token);
    this.socket.emit('selectInstrument', token);
  }

  getSelectedToken(): number | null {
    return this.selectedTokenSubject.value;
  }
}
