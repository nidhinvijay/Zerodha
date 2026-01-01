import { Component, inject } from '@angular/core';
import { AsyncPipe, DecimalPipe, DatePipe } from '@angular/common';
import { SignalService } from './signal.service';
import { FsmService } from './fsm.service';
import { InstrumentService } from './instrument.service';

@Component({
  selector: 'app-root',
  imports: [AsyncPipe, DecimalPipe, DatePipe],
  template: `
    <div class="dashboard">
      <h1>📈 Zerodha Tick Dashboard</h1>
      
      <!-- Instrument Dropdown -->
      <div class="instrument-select">
        <select (change)="onInstrumentChange($event)">
          @for (inst of instruments$ | async; track inst.token) {
            <option [value]="inst.token" [selected]="inst.token === (selectedToken$ | async)">
              {{ inst.zerodha }} ({{ inst.exchange }})
            </option>
          }
        </select>
      </div>
      
      <!-- FSM State Table -->
      <div class="card fsm-card">
        <table>
          <thead>
            <tr>
              <th>Instrument</th>
              <th>LTP</th>
              <th>Entry</th>
              <th>Threshold</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            @if (fsm$ | async; as fsm) {
              <tr>
                <td>{{ fsm.symbol || '--' }}</td>
                <td>{{ fsm.ltp ? (fsm.ltp | number:'1.2-2') : '--' }}</td>
                <td>{{ fsm.entryPrice ? (fsm.entryPrice | number:'1.2-2') : '--' }}</td>
                <td>{{ fsm.threshold ? (fsm.threshold | number:'1.2-2') : '--' }}</td>
                <td [class]="fsm.state.toLowerCase()">{{ fsm.state }}</td>
              </tr>
            } @else {
              <tr><td colspan="5" class="empty">Select an instrument</td></tr>
            }
          </tbody>
        </table>
        @if ((fsm$ | async)?.blockedAtMs; as blockedAt) {
          <div class="blocked-info">⏳ Blocked since {{ blockedAt | date:'HH:mm:ss' }} — retries at next :00</div>
        }
      </div>

      <!-- PnL Cards -->
      <div class="pnl-cards">
        @if (fsm$ | async; as fsm) {
          <!-- Paper Trading -->
          <div class="pnl-card paper">
            <h3>📝 Paper Trading</h3>
            <div class="pnl-row">
              <span>Unrealized:</span>
              <span [class.positive]="fsm.unrealizedPnL > 0" [class.negative]="fsm.unrealizedPnL < 0">
                ₹{{ fsm.unrealizedPnL | number:'1.2-2' }}
              </span>
            </div>
            <div class="pnl-row">
              <span>Realized:</span>
              <span [class.positive]="fsm.realizedPnL > 0" [class.negative]="fsm.realizedPnL < 0">
                ₹{{ fsm.realizedPnL | number:'1.2-2' }}
              </span>
            </div>
            <div class="pnl-row total">
              <span>Cumulative:</span>
              <span [class.positive]="fsm.cumPnL > 0" [class.negative]="fsm.cumPnL < 0">
                ₹{{ fsm.cumPnL | number:'1.2-2' }}
              </span>
            </div>
          </div>

          <!-- Live Trading -->
          <div class="pnl-card live" [class.active]="fsm.liveActive">
            <h3>🔴 Live Trading <span class="status">{{ fsm.liveActive ? 'ACTIVE' : 'INACTIVE' }}</span></h3>
            @if (fsm.liveActive) {
              <div class="pnl-row">
                <span>Entry:</span>
                <span>₹{{ fsm.liveEntryPrice | number:'1.2-2' }}</span>
              </div>
              <div class="pnl-row">
                <span>Unrealized:</span>
                <span [class.positive]="fsm.liveUnrealizedPnL > 0" [class.negative]="fsm.liveUnrealizedPnL < 0">
                  ₹{{ fsm.liveUnrealizedPnL | number:'1.2-2' }}
                </span>
              </div>
            }
            <div class="pnl-row">
              <span>Realized:</span>
              <span [class.positive]="fsm.liveRealizedPnL > 0" [class.negative]="fsm.liveRealizedPnL < 0">
                ₹{{ fsm.liveRealizedPnL | number:'1.2-2' }}
              </span>
            </div>
            <div class="pnl-row total">
              <span>Cumulative:</span>
              <span [class.positive]="fsm.liveCumPnL > 0" [class.negative]="fsm.liveCumPnL < 0">
                ₹{{ fsm.liveCumPnL | number:'1.2-2' }}
              </span>
            </div>
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
            @if (fsm.stateLog.length === 0) {
              <div class="empty">No state changes yet</div>
            } @else {
              <div class="log-list">
                @for (log of fsm.stateLog; track log.timestamp) {
                  <div class="log-row" [class]="log.event.toLowerCase()">
                    <span class="log-time">{{ log.timestamp | date:'HH:mm:ss' }}</span>
                    <span class="log-event">{{ log.event }}</span>
                    <span class="log-state">{{ log.state }}</span>
                    <span class="log-detail">
                      @if (log.ltp) { LTP: {{ log.ltp | number:'1.2-2' }} }
                      @if (log.threshold) { TH: {{ log.threshold | number:'1.2-2' }} }
                    </span>
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
    h1 { margin-bottom: 1rem; font-weight: 300; }
    
    /* Instrument Dropdown */
    .instrument-select { margin-bottom: 1.5rem; }
    .instrument-select select {
      padding: 0.75rem 1.5rem;
      font-size: 1rem;
      background: rgba(255,255,255,0.1);
      color: #fff;
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 8px;
      cursor: pointer;
      min-width: 300px;
    }
    .instrument-select select:focus { outline: none; border-color: #4fc3f7; }
    .instrument-select select option { background: #1a1a2e; color: #fff; }
    
    /* FSM Table */
    .fsm-card { margin-bottom: 1.5rem; overflow-x: auto; }
    table { border-collapse: collapse; width: 100%; }
    th, td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.1); }
    th { font-weight: 500; opacity: 0.7; font-size: 0.85rem; }
    td { font-size: 0.9rem; }
    td.buyposition { color: #00c853; font-weight: 600; }
    td.noposition_blocked { color: #ff9800; font-weight: 600; }
    td.nosignal { opacity: 0.6; }
    .blocked-info { 
      margin-top: 1rem; padding: 0.5rem 1rem; 
      background: rgba(255,152,0,0.2); border-radius: 8px; 
      font-size: 0.85rem; color: #ff9800;
    }
    
    /* PnL Cards */
    .pnl-cards { display: flex; gap: 1.5rem; margin-bottom: 1.5rem; flex-wrap: wrap; justify-content: center; }
    .pnl-card {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 1rem 1.5rem;
      min-width: 200px;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .pnl-card h3 { margin: 0 0 0.75rem 0; font-size: 1rem; font-weight: 400; }
    .pnl-card.paper { border-left: 3px solid #4fc3f7; }
    .pnl-card.live { border-left: 3px solid #666; }
    .pnl-card.live.active { border-left: 3px solid #ff5252; background: rgba(255,82,82,0.1); }
    .pnl-row { display: flex; justify-content: space-between; padding: 0.3rem 0; font-size: 0.9rem; }
    .pnl-row.total { border-top: 1px solid rgba(255,255,255,0.1); margin-top: 0.5rem; padding-top: 0.5rem; font-weight: 600; }
    .positive { color: #00c853; }
    .negative { color: #ff5252; }
    .status { font-size: 0.7rem; padding: 0.2rem 0.5rem; border-radius: 4px; margin-left: 0.5rem; }
    .pnl-card.live .status { background: rgba(255,255,255,0.1); }
    .pnl-card.live.active .status { background: #ff5252; color: #fff; }
    
    .cards { display: flex; gap: 2rem; flex-wrap: wrap; justify-content: center; }
    .card {
      background: rgba(255,255,255,0.05);
      border-radius: 16px;
      padding: 1.5rem 2rem;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.1);
    }
    .signals-card { min-width: 320px; max-height: 250px; overflow-y: auto; }
    .log-card { min-width: 400px; max-height: 250px; overflow-y: auto; }
    
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .card-header h2 { margin: 0; font-size: 1.2rem; font-weight: 400; }
    .card-header button { 
      background: rgba(255,255,255,0.1); border: none; color: #fff; 
      padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer;
    }
    .card-header button:hover { background: rgba(255,255,255,0.2); }
    
    .empty { opacity: 0.5; text-align: center; padding: 1rem; }
    .signal-list, .log-list { display: flex; flex-direction: column; gap: 0.5rem; }
    .signal-row, .log-row {
      display: flex; justify-content: space-between; padding: 0.6rem 0.8rem;
      background: rgba(255,255,255,0.05); border-radius: 8px; font-size: 0.85rem; gap: 0.5rem;
    }
    .signal-row.buy { border-left: 3px solid #00c853; }
    .signal-row.sell { border-left: 3px solid #ff5252; }
    .intent { font-weight: 600; min-width: 50px; }
    .signal-row.buy .intent { color: #00c853; }
    .signal-row.sell .intent { color: #ff5252; }
    .stoppx { opacity: 0.9; }
    .time { opacity: 0.6; font-size: 0.8rem; }
    
    /* Log styles */
    .log-row { display: grid; grid-template-columns: 70px 130px 140px 1fr; align-items: center; }
    .log-row.entry, .log-row.buy_signal { border-left: 3px solid #00c853; }
    .log-row.entry .log-event, .log-row.buy_signal .log-event { color: #00c853; }
    .log-row.blocked { border-left: 3px solid #ff9800; }
    .log-row.blocked .log-event { color: #ff9800; }
    .log-row.stop_loss { border-left: 3px solid #ff5252; }
    .log-row.stop_loss .log-event { color: #ff5252; }
    .log-row.sell_exit, .log-row.sell_signal { border-left: 3px solid #ff5252; }
    .log-row.sell_exit .log-event, .log-row.sell_signal .log-event { color: #ff5252; }
    .log-row.live_activated { border-left: 3px solid #ff5252; }
    .log-row.live_activated .log-event { color: #ff5252; }
    .log-row.live_closed { border-left: 3px solid #ff9800; }
    .log-row.live_closed .log-event { color: #ff9800; }
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
  private instrumentService = inject(InstrumentService);
  
  instruments$ = this.instrumentService.instruments$;
  selectedToken$ = this.instrumentService.selectedToken$;
  signals$ = this.signalService.signals$;
  fsm$ = this.fsmService.fsm$;

  onInstrumentChange(event: Event) {
    const token = Number((event.target as HTMLSelectElement).value);
    this.instrumentService.selectInstrument(token);
  }

  clearSignals() {
    this.signalService.clearSignals();
  }
}
