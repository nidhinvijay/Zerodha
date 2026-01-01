import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SocketService } from './socket.service';

export interface Instrument {
  tradingview: string;
  exchange: string;
  zerodha: string;
  token: number;
  lot: number;
}

@Injectable({ providedIn: 'root' })
export class InstrumentService {
  private socketService = inject(SocketService);
  
  private instrumentsSubject = new BehaviorSubject<Instrument[]>([]);
  readonly instruments$ = this.instrumentsSubject.asObservable();
  
  private selectedTokenSubject = new BehaviorSubject<number | null>(null);
  readonly selectedToken$ = this.selectedTokenSubject.asObservable();

  constructor() {
    const socket = this.socketService.socket;
    
    // Receive instruments list on connect
    socket.on('instruments', (list: Instrument[]) => {
      this.instrumentsSubject.next(list);
      // Auto-select first instrument
      if (list.length > 0 && !this.selectedTokenSubject.value) {
        this.selectInstrument(list[0].token);
      }
    });
  }

  selectInstrument(token: number) {
    this.selectedTokenSubject.next(token);
    this.socketService.socket.emit('selectInstrument', token);
  }

  getSelectedToken(): number | null {
    return this.selectedTokenSubject.value;
  }
}
