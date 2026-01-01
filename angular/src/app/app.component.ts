import { Component, inject } from '@angular/core';
import { AsyncPipe, DecimalPipe, DatePipe } from '@angular/common';
import { TickService, Tick } from './tick.service';

@Component({
  selector: 'app-root',
  imports: [AsyncPipe, DecimalPipe, DatePipe],
  template: `
    <div class="dashboard">
      <h1>📈 Zerodha Tick Dashboard</h1>
      
      @if (tick$ | async; as tick) {
        <div class="card">
          <div class="symbol">{{ tick.symbol }}</div>
          <div class="ltp" [class.up]="tick.change > 0" [class.down]="tick.change < 0">
            ₹{{ tick.ltp | number:'1.2-2' }}
          </div>
          <div class="change" [class.up]="tick.change > 0" [class.down]="tick.change < 0">
            {{ tick.change > 0 ? '+' : '' }}{{ tick.change | number:'1.2-2' }}%
          </div>
          <div class="meta">
            <span>Updated: {{ tick.timestamp | date:'HH:mm:ss' }}</span>
          </div>
        </div>
      } @else {
        <div class="card waiting">
          ⏳ Waiting for tick data...
        </div>
      }
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
    .card {
      background: rgba(255,255,255,0.05);
      border-radius: 16px;
      padding: 2rem 3rem;
      text-align: center;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.1);
    }
    .symbol { font-size: 1.2rem; opacity: 0.8; margin-bottom: 0.5rem; }
    .ltp { font-size: 3rem; font-weight: 600; }
    .change { font-size: 1.5rem; margin: 0.5rem 0; }
    .up { color: #00c853; }
    .down { color: #ff5252; }
    .meta { font-size: 0.85rem; opacity: 0.6; display: flex; gap: 1.5rem; justify-content: center; margin-top: 1rem; }
    .waiting { font-size: 1.2rem; opacity: 0.7; }
  `]
})
export class AppComponent {
  private tickService = inject(TickService);
  tick$ = this.tickService.tick$;
}
