import { Component, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { SmartDatePipe } from './smart-date.pipe';

interface HistoryDate {
  date: string;
  savedAt: string;
}

interface Trade {
  entry: number;
  exit: number;
  pnl: number;
  lot: number;
  reason: string;
  timestamp: string;
}

interface InstrumentData {
  token: number;
  exchange: string;
  lot: number;
  paperRealizedPnL: number;
  liveRealizedPnL: number;
  paperTrades: Trade[];
  liveTrades: Trade[];
  stateLog: any[];
  signals: any[];
}

interface DayData {
  date: string;
  savedAt: string;
  instruments: { [key: string]: InstrumentData };
}

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, RouterLink, SmartDatePipe],
  template: `
    <div class="history-page">
      <div class="header">
        <h1>📊 Trading History</h1>
        <a routerLink="/" class="back-btn">← Back to Dashboard</a>
      </div>

      <!-- Date Selection -->
      <div class="date-selector">
        <h2>Select Date</h2>
        <div class="date-list">
          @if (dates.length === 0) {
            <div class="empty">No history saved yet</div>
          }
          @for (d of dates; track d.date) {
            <button 
              [class.active]="selectedDate === d.date"
              (click)="loadDay(d.date)">
              {{ d.date }}
            </button>
          }
        </div>
      </div>

      <!-- Day Data -->
      @if (dayData) {
        <div class="day-content">
          <h2>{{ dayData.date }} <span class="saved-at">Saved: {{ dayData.savedAt | date:'HH:mm:ss' }}</span></h2>
          
          @for (inst of getInstruments(); track inst.key) {
            <div class="instrument-section">
              <h3>{{ inst.key }} ({{ inst.data.exchange }})</h3>
              
              <div class="pnl-summary">
                <div class="pnl-box paper">
                  <span>Paper PnL:</span>
                  <span [class.positive]="inst.data.paperRealizedPnL > 0" [class.negative]="inst.data.paperRealizedPnL < 0">
                    ₹{{ inst.data.paperRealizedPnL | number:'1.2-2' }}
                  </span>
                </div>
                <div class="pnl-box live">
                  <span>Live PnL:</span>
                  <span [class.positive]="inst.data.liveRealizedPnL > 0" [class.negative]="inst.data.liveRealizedPnL < 0">
                    ₹{{ inst.data.liveRealizedPnL | number:'1.2-2' }}
                  </span>
                </div>
              </div>

              <div class="tables-row">
                <!-- Paper Trades -->
                <div class="table-card">
                  <h4>📝 Paper Trades ({{ inst.data.paperTrades.length }})</h4>
                  @if (inst.data.paperTrades.length === 0) {
                    <div class="empty">No paper trades</div>
                  } @else {
                    <table>
                      <thead><tr><th>Entry</th><th>Exit</th><th>PnL</th><th>Reason</th><th>Time</th></tr></thead>
                      <tbody>
                        @for (t of inst.data.paperTrades; track t.timestamp) {
                          <tr>
                            <td>₹{{ t.entry | number:'1.2-2' }}</td>
                            <td>₹{{ t.exit | number:'1.2-2' }}</td>
                            <td [class.positive]="t.pnl > 0" [class.negative]="t.pnl < 0">₹{{ t.pnl | number:'1.2-2' }}</td>
                            <td>{{ t.reason }}</td>
                            <td>{{ t.timestamp | smartDate }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  }
                </div>

                <!-- Live Trades -->
                <div class="table-card">
                  <h4>🔴 Live Trades ({{ inst.data.liveTrades.length }})</h4>
                  @if (inst.data.liveTrades.length === 0) {
                    <div class="empty">No live trades</div>
                  } @else {
                    <table>
                      <thead><tr><th>Entry</th><th>Exit</th><th>PnL</th><th>Reason</th><th>Time</th></tr></thead>
                      <tbody>
                        @for (t of inst.data.liveTrades; track t.timestamp) {
                          <tr>
                            <td>₹{{ t.entry | number:'1.2-2' }}</td>
                            <td>₹{{ t.exit | number:'1.2-2' }}</td>
                            <td [class.positive]="t.pnl > 0" [class.negative]="t.pnl < 0">₹{{ t.pnl | number:'1.2-2' }}</td>
                            <td>{{ t.reason }}</td>
                            <td>{{ t.timestamp | smartDate }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  }
                </div>
              </div>

              <!-- State Log -->
              <div class="table-card full-width">
                <h4>📋 State Log ({{ inst.data.stateLog.length }})</h4>
                @if (inst.data.stateLog.length === 0) {
                  <div class="empty">No state log</div>
                } @else {
                  <table>
                    <thead><tr><th>Time</th><th>Event</th><th>State</th><th>LTP</th><th>Threshold</th></tr></thead>
                    <tbody>
                      @for (log of inst.data.stateLog; track log.timestamp) {
                        <tr>
                          <td>{{ log.timestamp | smartDate }}</td>
                          <td>{{ log.event }}</td>
                          <td>{{ log.state }}</td>
                          <td>{{ log.ltp | number:'1.2-2' }}</td>
                          <td>{{ log.threshold | number:'1.2-2' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                }
              </div>

              <!-- Signals -->
              <div class="table-card full-width">
                <h4>📡 Signals ({{ inst.data.signals.length }})</h4>
                @if (inst.data.signals.length === 0) {
                  <div class="empty">No signals</div>
                } @else {
                  <table>
                    <thead><tr><th>Time</th><th>Intent</th><th>StopPx</th></tr></thead>
                    <tbody>
                      @for (s of inst.data.signals; track s.timestamp) {
                        <tr>
                          <td>{{ s.timestamp | smartDate }}</td>
                          <td [class.buy]="s.intent === 'BUY'" [class.sell]="s.intent === 'SELL'">{{ s.intent }}</td>
                          <td>₹{{ s.stoppx | number:'1.2-2' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .history-page {
      min-height: 100vh;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #fff;
      font-family: 'Segoe UI', sans-serif;
      padding: 2rem;
    }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
    h1 { font-weight: 300; }
    .back-btn { color: #4fc3f7; text-decoration: none; }
    .back-btn:hover { text-decoration: underline; }
    
    .date-selector { margin-bottom: 2rem; }
    .date-selector h2 { font-weight: 400; margin-bottom: 1rem; }
    .date-list { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .date-list button {
      padding: 0.5rem 1rem;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      color: #fff;
      border-radius: 6px;
      cursor: pointer;
    }
    .date-list button:hover { background: rgba(255,255,255,0.2); }
    .date-list button.active { background: #4fc3f7; border-color: #4fc3f7; }
    
    .day-content h2 { font-weight: 400; margin-bottom: 1.5rem; }
    .saved-at { font-size: 0.8rem; opacity: 0.6; }
    
    .instrument-section {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }
    .instrument-section h3 { margin: 0 0 1rem 0; font-weight: 400; }
    
    .pnl-summary { display: flex; gap: 1rem; margin-bottom: 1rem; }
    .pnl-box { padding: 0.75rem 1rem; border-radius: 8px; display: flex; gap: 1rem; }
    .pnl-box.paper { background: rgba(79,195,247,0.1); border-left: 3px solid #4fc3f7; }
    .pnl-box.live { background: rgba(255,82,82,0.1); border-left: 3px solid #ff5252; }
    
    .tables-row { display: flex; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap; }
    .table-card { 
      background: rgba(0,0,0,0.2); 
      border-radius: 8px; 
      padding: 1rem; 
      flex: 1; 
      min-width: 300px;
      max-height: 200px;
      overflow-y: auto;
    }
    .table-card.full-width { flex-basis: 100%; max-height: 150px; }
    .table-card h4 { margin: 0 0 0.75rem 0; font-size: 0.9rem; font-weight: 400; }
    
    table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
    th, td { padding: 0.4rem 0.5rem; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.1); }
    th { opacity: 0.7; }
    
    .positive { color: #00c853; }
    .negative { color: #ff5252; }
    .buy { color: #00c853; font-weight: 600; }
    .sell { color: #ff5252; font-weight: 600; }
    .empty { opacity: 0.5; text-align: center; padding: 1rem; }
  `]
})
export class HistoryComponent implements OnInit {
  private http = inject(HttpClient);

  dates: HistoryDate[] = [];
  selectedDate: string | null = null;
  dayData: DayData | null = null;

  ngOnInit() {
    this.loadDates();
  }

  loadDates() {
    const baseUrl = location.hostname === 'localhost' ? 'http://localhost:3004' : '';
    this.http.get<HistoryDate[]>(`${baseUrl}/api/history`).subscribe({
      next: (dates) => this.dates = dates,
      error: (err) => console.error('Failed to load history dates', err)
    });
  }

  loadDay(date: string) {
    this.selectedDate = date;
    const baseUrl = location.hostname === 'localhost' ? 'http://localhost:3004' : '';
    this.http.get<DayData>(`${baseUrl}/api/history/${date}`).subscribe({
      next: (data) => this.dayData = data,
      error: (err) => console.error('Failed to load day data', err)
    });
  }

  getInstruments(): { key: string; data: InstrumentData }[] {
    if (!this.dayData) return [];
    return Object.entries(this.dayData.instruments).map(([key, data]) => ({ key, data }));
  }
}
