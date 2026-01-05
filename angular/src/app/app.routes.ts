import { Routes } from '@angular/router';
import { DashboardComponent } from './dashboard.component';
import { HistoryComponent } from './history.component';
import { AccountsComponent } from './accounts.component';

export const routes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'history', component: HistoryComponent },
  { path: 'accounts', component: AccountsComponent },
];
