import { Component, inject } from '@angular/core';
import { AsyncPipe, DecimalPipe, DatePipe } from '@angular/common';
import { SignalService } from './signal.service';
import { FsmService } from './fsm.service';

@Component({
  selector: 'app-root',
  imports: [AsyncPipe, DecimalPipe, DatePipe],
  template: `
    <div class="dashboard">
      <h1>📈 Zerodha Tick Dashboard</h1>
      
      <!-- FSM State Table -->
      <div class="card fsm-card">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Instrument</th>
              <th>LTP</th>
              <th>THRESHOLD</th>
              <th>NOSIGNAL</th>
              <th>NOPOSITION_SIGNAL</th>
              <th>BUYPOSITION</th>
              <th>NOPOSITION_BLOCKED</th>
            </tr>
          </thead>
          <tbody>
            @if (fsm$ | async; as fsm) {
              <tr>
                <td>1</td>
                <td>{{ fsm.symbol || '--' }}</td>
                <td>{{ fsm.ltp ? (fsm.ltp | number:'1.2-2') : '--' }}</td>
                <td>{{ fsm.threshold ? (fsm.threshold | number:'1.2-2') : '--' }}</td>
                <td [class.active]="fsm.state === 'NOSIGNAL'">{{ fsm.state === 'NOSIGNAL' }}</td>
                <td [class.active]="fsm.state === 'NOPOSITION_SIGNAL'">{{ fsm.state === 'NOPOSITION_SIGNAL' }}</td>
                <td [class.active]="fsm.state === 'BUYPOSITION'" [class.buy]="fsm.state === 'BUYPOSITION'">{{ fsm.state === 'BUYPOSITION' }}</td>
                <td [class.active]="fsm.state === 'NOPOSITION_BLOCKED'" [class.blocked]="fsm.state === 'NOPOSITION_BLOCKED'">{{ fsm.state === 'NOPOSITION_BLOCKED' }}</td>
              </tr>
            }
          </tbody>
        </table>
        @if ((fsm$ | async)?.blockedAtMs; as blockedAt) {
          <div class="blocked-info">
            ⏳ Blocked since {{ blockedAt | date:'HH:mm:ss' }} — retries at next :00
          </div>
        }
      </div>

      <div class="cards">
        <!-- Signals Card -->
        <div class="card signals-card">
          <div class="card-header">
            <h2>📡 Signals</h2>
            <button (click)="clearSignals()">Clear</button>
          </div>
          @if (signals$ | async; as signals) {
            @if (signals.length === 0) {
              <div class="empty">No signals yet</div>
            } @else {
              <div class="signal-list">
                @for (s of signals; track s.timestamp) {
                  <div class="signal-row" [class.buy]="s.intent === 'BUY'" [class.sell]="s.intent === 'SELL'">
                    <span class="intent">{{ s.intent }}</span>
                    <span class="stoppx">₹{{ s.stoppx | number:'1.2-2' }}</span>
                    <span class="time">{{ s.timestamp | date:'HH:mm:ss' }}</span>
                  </div>
                }
              </div>
            }
          }
        </div>

        <!-- State Log Card -->
        <div class="card log-card">
          <div class="card-header">
            <h2>📋 State Log</h2>
          </div>
          @if (fsm$ | async; as fsm) {
            @if (fsm.stateLog?.length === 0) {
              <div class="empty">No state changes yet</div>
            } @else {
              <div class="log-list">
                @for (log of fsm.stateLog; track log.timestamp) {
                  <div class="log-row" [class]="log.event.toLowerCase()">
                    <span class="log-time">{{ log.timestamp | date:'HH:mm:ss' }}</span>
                    <span class="log-event">{{ log.event }}</span>
                    <span class="log-state">{{ log.state }}</span>
                    @if (log.ltp) {
                      <span class="log-detail">LTP: {{ log.ltp | number:'1.2-2' }}</span>
                    }
                    @if (log.threshold) {
                      <span class="log-detail">TH: {{ log.threshold | number:'1.2-2' }}</span>
                    }
                  </div>
                }
              </div>
            }
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard {
      min-height: 100vh;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #fff;
      font-family: 'Segoe UI', sans-serif;
      padding: 2rem;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    h1 { margin-bottom: 2rem; font-weight: 300; }
    
    /* FSM Table */
    .fsm-card { margin-bottom: 2rem; overflow-x: auto; }
    table { border-collapse: collapse; width: 100%; }
    th, td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.1); }
    th { font-weight: 500; opacity: 0.7; font-size: 0.85rem; }
    td { font-size: 0.9rem; }
    td.active { font-weight: 600; }
    td.buy { color: #00c853; }
    td.blocked { color: #ff9800; }
    .blocked-info { 
      margin-top: 1rem; 
      padding: 0.5rem 1rem; 
      background: rgba(255,152,0,0.2); 
      border-radius: 8px; 
      font-size: 0.85rem;
      color: #ff9800;
    }
    
    .cards { display: flex; gap: 2rem; flex-wrap: wrap; justify-content: center; }
    .card {
      background: rgba(255,255,255,0.05);
      border-radius: 16px;
      padding: 1.5rem 2rem;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.1);
    }
    .signals-card { min-width: 320px; max-height: 300px; overflow-y: auto; }
    .log-card { min-width: 400px; max-height: 300px; overflow-y: auto; }
    
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .card-header h2 { margin: 0; font-size: 1.2rem; font-weight: 400; }
    .card-header button { 
      background: rgba(255,255,255,0.1); 
      border: none; 
      color: #fff; 
      padding: 0.4rem 0.8rem; 
      border-radius: 6px; 
      cursor: pointer;
    }
    .card-header button:hover { background: rgba(255,255,255,0.2); }
    
    .empty { opacity: 0.5; text-align: center; padding: 1rem; }
    .signal-list, .log-list { display: flex; flex-direction: column; gap: 0.5rem; }
    .signal-row, .log-row {
      display: flex;
      justify-content: space-between;
      padding: 0.6rem 0.8rem;
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
      font-size: 0.85rem;
      gap: 0.5rem;
    }
    .signal-row.buy { border-left: 3px solid #00c853; }
    .signal-row.sell { border-left: 3px solid #ff5252; }
    .intent { font-weight: 600; min-width: 50px; }
    .signal-row.buy .intent { color: #00c853; }
    .signal-row.sell .intent { color: #ff5252; }
    .stoppx { opacity: 0.9; }
    .time { opacity: 0.6; font-size: 0.8rem; }
    
    /* Log styles */
    .log-row { display: grid; grid-template-columns: 70px 120px 140px 1fr; align-items: center; }
    .log-row.entry, .log-row.buy_signal { border-left: 3px solid #00c853; }
    .log-row.entry .log-event, .log-row.buy_signal .log-event { color: #00c853; }
    .log-row.blocked { border-left: 3px solid #ff9800; }
    .log-row.blocked .log-event { color: #ff9800; }
    .log-row.stop_loss { border-left: 3px solid #ff5252; }
    .log-row.stop_loss .log-event { color: #ff5252; }
    .log-row.sell_exit, .log-row.sell_signal { border-left: 3px solid #ff5252; }
    .log-row.sell_exit .log-event, .log-row.sell_signal .log-event { color: #ff5252; }
    .log-row.minute_retry { border-left: 3px solid #2196f3; }
    .log-row.minute_retry .log-event { color: #2196f3; }
    .log-time { opacity: 0.6; }
    .log-event { font-weight: 600; }
    .log-state { opacity: 0.8; }
    .log-detail { opacity: 0.6; font-size: 0.8rem; }
  `]
})
export class AppComponent {
  private signalService = inject(SignalService);
  private fsmService = inject(FsmService);
  
  signals$ = this.signalService.signals$;
  fsm$ = this.fsmService.fsm$;

  clearSignals() {
    this.signalService.clearSignals();
  }
}
