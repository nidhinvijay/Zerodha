import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';

interface Account {
  id: string;
  name: string;
  api_key?: string;
  enabled: boolean;
  hasCredentials: boolean;
  last_order: string | null;
  last_token_update?: string | null;
  created_at: string;
}

interface AccountForm {
  name: string;
  api_key: string;
  api_secret: string;
  access_token: string;
}

@Component({
  selector: 'app-accounts',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="accounts-page">
      <!-- Header -->
      <header class="header">
        <div class="header-left">
          <a routerLink="/" class="back-link">← Dashboard</a>
          <h1>👥 Account Manager</h1>
        </div>
        <div class="header-right">
          <span class="account-count">{{ accounts.length }} Accounts</span>
          <button class="btn btn-primary" (click)="showAddModal = true">+ Add Account</button>
        </div>
      </header>

      <!-- Info Banner -->
      <div class="info-banner">
        <p>💡 When live trading activates, BUY/SELL orders are placed on <strong>all enabled accounts simultaneously</strong>.</p>
        <p>⚠️ Access tokens expire daily. Update them before market opens (9:15 AM).</p>
      </div>

      <!-- Accounts Grid -->
      <div class="accounts-grid">
        <div *ngFor="let acc of accounts" class="account-card" [class.disabled]="!acc.enabled">
          <div class="card-header">
            <span class="status-dot" [class.active]="acc.enabled && acc.hasCredentials"></span>
            <h3>{{ acc.name }}</h3>
            <label class="toggle">
              <input type="checkbox" [checked]="acc.enabled" (change)="toggleEnabled(acc)">
              <span class="slider"></span>
            </label>
          </div>
          
          <div class="card-body">
            <div class="credential-status">
              <span *ngIf="acc.hasCredentials" class="badge success">✓ Credentials Set</span>
              <span *ngIf="!acc.hasCredentials" class="badge warning">⚠ Missing Credentials</span>
            </div>
            
            <div class="last-order" *ngIf="acc.last_order">
              Last Order: {{ acc.last_order | date:'short' }}
            </div>
            <div class="last-order" *ngIf="!acc.last_order">
              No orders placed yet
            </div>
          </div>
          
          <div class="card-actions">
            <button class="btn btn-small btn-login" (click)="loginZerodha(acc)" 
                    [disabled]="!acc.hasCredentials"
                    title="Login with Zerodha to auto-generate token">
              🔑 Login
            </button>
            <button class="btn btn-small" (click)="editAccount(acc)">Edit</button>
            <button class="btn btn-small btn-danger" (click)="confirmDelete(acc)">Delete</button>
          </div>
          
          <div class="token-info" *ngIf="acc.last_token_update">
            Token updated: {{ acc.last_token_update | date:'short' }}
          </div>
        </div>

        <!-- Empty State -->
        <div *ngIf="accounts.length === 0" class="empty-state">
          <p>No accounts configured yet.</p>
          <button class="btn btn-primary" (click)="showAddModal = true">+ Add Your First Account</button>
        </div>
      </div>

      <!-- Add/Edit Modal -->
      <div class="modal-overlay" *ngIf="showAddModal || showEditModal" (click)="closeModals()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>{{ showEditModal ? 'Edit Account' : 'Add Account' }}</h2>
          
          <div class="form-group">
            <label>Account Name</label>
            <input type="text" [(ngModel)]="form.name" placeholder="e.g., Primary Account">
          </div>
          
          <div class="form-group">
            <label>API Key</label>
            <input type="text" [(ngModel)]="form.api_key" placeholder="Your Kite API Key">
          </div>
          
          <div class="form-group">
            <label>API Secret</label>
            <input type="password" [(ngModel)]="form.api_secret" placeholder="Your Kite API Secret">
            <small>Required for auto token generation via Zerodha login</small>
          </div>
          
          <div class="form-group">
            <label>Access Token (Optional)</label>
            <input type="password" [(ngModel)]="form.access_token" placeholder="Leave empty to use Zerodha login">
            <small>💡 Use "Login" button instead for automatic token generation</small>
          </div>
          
          <div class="modal-actions">
            <button class="btn" (click)="closeModals()">Cancel</button>
            <button class="btn btn-primary" (click)="saveAccount()">
              {{ showEditModal ? 'Update' : 'Add Account' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Token Update Modal -->
      <div class="modal-overlay" *ngIf="showTokenModal" (click)="closeModals()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>Update Access Token</h2>
          <p class="modal-subtitle">{{ editingAccount?.name }}</p>
          
          <div class="form-group">
            <label>New Access Token</label>
            <input type="password" [(ngModel)]="newToken" placeholder="Paste new access token">
          </div>
          
          <div class="modal-actions">
            <button class="btn" (click)="closeModals()">Cancel</button>
            <button class="btn btn-primary" (click)="saveToken()">Update Token</button>
          </div>
        </div>
      </div>

      <!-- Delete Confirmation Modal -->
      <div class="modal-overlay" *ngIf="showDeleteModal" (click)="closeModals()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>⚠️ Delete Account</h2>
          <p>Are you sure you want to delete <strong>{{ editingAccount?.name }}</strong>?</p>
          <p class="warning-text">This action cannot be undone.</p>
          
          <div class="modal-actions">
            <button class="btn" (click)="closeModals()">Cancel</button>
            <button class="btn btn-danger" (click)="deleteAccount()">Delete</button>
          </div>
        </div>
      </div>

      <!-- Status Message -->
      <div class="status-message" *ngIf="statusMessage" [class.error]="isError">
        {{ statusMessage }}
      </div>
    </div>
  `,
  styles: [`
    .accounts-page {
      min-height: 100vh;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #e0e0e0;
      padding: 20px;
      font-family: 'Inter', -apple-system, sans-serif;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 20px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .back-link {
      color: #64b5f6;
      text-decoration: none;
      font-size: 14px;
    }

    .back-link:hover {
      text-decoration: underline;
    }

    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 15px;
    }

    .account-count {
      background: rgba(100, 181, 246, 0.2);
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 14px;
      color: #64b5f6;
    }

    .info-banner {
      background: rgba(255, 193, 7, 0.1);
      border: 1px solid rgba(255, 193, 7, 0.3);
      border-radius: 8px;
      padding: 15px 20px;
      margin-bottom: 25px;
    }

    .info-banner p {
      margin: 5px 0;
      font-size: 14px;
    }

    .accounts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 20px;
    }

    .account-card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 20px;
      transition: all 0.3s ease;
    }

    .account-card:hover {
      border-color: rgba(100, 181, 246, 0.5);
      transform: translateY(-2px);
    }

    .account-card.disabled {
      opacity: 0.6;
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 15px;
    }

    .status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #f44336;
    }

    .status-dot.active {
      background: #4caf50;
      box-shadow: 0 0 10px rgba(76, 175, 80, 0.5);
    }

    .card-header h3 {
      flex: 1;
      margin: 0;
      font-size: 18px;
    }

    .toggle {
      position: relative;
      width: 44px;
      height: 24px;
    }

    .toggle input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #444;
      border-radius: 24px;
      transition: 0.3s;
    }

    .slider:before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      border-radius: 50%;
      transition: 0.3s;
    }

    .toggle input:checked + .slider {
      background-color: #4caf50;
    }

    .toggle input:checked + .slider:before {
      transform: translateX(20px);
    }

    .card-body {
      margin-bottom: 15px;
    }

    .credential-status {
      margin-bottom: 10px;
    }

    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 12px;
    }

    .badge.success {
      background: rgba(76, 175, 80, 0.2);
      color: #81c784;
    }

    .badge.warning {
      background: rgba(255, 152, 0, 0.2);
      color: #ffb74d;
    }

    .last-order {
      font-size: 12px;
      color: #888;
    }

    .card-actions {
      display: flex;
      gap: 8px;
    }

    .btn {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      background: rgba(255,255,255,0.1);
      color: #e0e0e0;
      transition: all 0.2s;
    }

    .btn:hover {
      background: rgba(255,255,255,0.2);
    }

    .btn-primary {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
    }

    .btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    }

    .btn-small {
      padding: 6px 12px;
      font-size: 12px;
    }

    .btn-token {
      background: rgba(33, 150, 243, 0.2);
      color: #64b5f6;
    }

    .btn-danger {
      background: rgba(244, 67, 54, 0.2);
      color: #ef5350;
    }

    .btn-danger:hover {
      background: rgba(244, 67, 54, 0.4);
    }

    .btn-login {
      background: linear-gradient(135deg, #ff9800, #f57c00);
      color: white;
    }

    .btn-login:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 15px rgba(255, 152, 0, 0.4);
    }

    .btn-login:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .token-info {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid rgba(255,255,255,0.1);
      font-size: 11px;
      color: #4caf50;
    }

    .empty-state {
      grid-column: 1 / -1;
      text-align: center;
      padding: 60px 20px;
      background: rgba(255,255,255,0.03);
      border-radius: 12px;
      border: 2px dashed rgba(255,255,255,0.1);
    }

    .empty-state p {
      margin-bottom: 20px;
      color: #888;
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal {
      background: #1e1e2f;
      border-radius: 12px;
      padding: 30px;
      width: 100%;
      max-width: 450px;
      border: 1px solid rgba(255,255,255,0.1);
    }

    .modal h2 {
      margin: 0 0 5px 0;
      font-size: 20px;
    }

    .modal-subtitle {
      color: #888;
      margin: 0 0 20px 0;
    }

    .form-group {
      margin-bottom: 20px;
    }

    .form-group label {
      display: block;
      margin-bottom: 6px;
      font-size: 14px;
      color: #aaa;
    }

    .form-group input {
      width: 100%;
      padding: 12px;
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 6px;
      background: rgba(255,255,255,0.05);
      color: #e0e0e0;
      font-size: 14px;
      box-sizing: border-box;
    }

    .form-group input:focus {
      outline: none;
      border-color: #667eea;
    }

    .form-group small {
      display: block;
      margin-top: 5px;
      font-size: 12px;
      color: #ff9800;
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 25px;
    }

    .warning-text {
      color: #ef5350;
      font-size: 14px;
    }

    .status-message {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #4caf50;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      animation: fadeIn 0.3s ease;
    }

    .status-message.error {
      background: #f44336;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class AccountsComponent implements OnInit {
  accounts: Account[] = [];
  
  showAddModal = false;
  showEditModal = false;
  showTokenModal = false;
  showDeleteModal = false;
  
  editingAccount: Account | null = null;
  
  form: AccountForm = {
    name: '',
    api_key: '',
    api_secret: '',
    access_token: ''
  };
  
  newToken = '';
  statusMessage = '';
  isError = false;
  
  // Base URL for API calls (localhost:3004 in dev, same origin in prod)
  private get baseUrl(): string {
    return location.hostname === 'localhost' ? 'http://localhost:3004' : '';
  }

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadAccounts();
  }

  loadAccounts() {
    this.http.get<Account[]>(`${this.baseUrl}/api/accounts`).subscribe({
      next: (accounts) => this.accounts = accounts,
      error: (err) => this.showStatus('Failed to load accounts', true)
    });
  }

  toggleEnabled(acc: Account) {
    this.http.put(`${this.baseUrl}/api/accounts/${acc.id}`, { enabled: !acc.enabled }).subscribe({
      next: () => {
        acc.enabled = !acc.enabled;
        this.showStatus(`${acc.name} ${acc.enabled ? 'enabled' : 'disabled'}`);
      },
      error: () => this.showStatus('Failed to update account', true)
    });
  }

  editAccount(acc: Account) {
    this.editingAccount = acc;
    this.form = {
      name: acc.name,
      api_key: '',
      api_secret: '',
      access_token: ''
    };
    this.showEditModal = true;
  }

  updateToken(acc: Account) {
    this.editingAccount = acc;
    this.newToken = '';
    this.showTokenModal = true;
  }

  confirmDelete(acc: Account) {
    this.editingAccount = acc;
    this.showDeleteModal = true;
  }

  closeModals() {
    this.showAddModal = false;
    this.showEditModal = false;
    this.showTokenModal = false;
    this.showDeleteModal = false;
    this.editingAccount = null;
    this.form = { name: '', api_key: '', api_secret: '', access_token: '' };
    this.newToken = '';
  }

  saveAccount() {
    if (!this.form.name) {
      this.showStatus('Account name is required', true);
      return;
    }

    if (this.showEditModal && this.editingAccount) {
      // Update existing
      const updates: any = { name: this.form.name };
      if (this.form.api_key) updates.api_key = this.form.api_key;
      if (this.form.api_secret) updates.api_secret = this.form.api_secret;
      if (this.form.access_token) updates.access_token = this.form.access_token;

      this.http.put(`${this.baseUrl}/api/accounts/${this.editingAccount.id}`, updates).subscribe({
        next: () => {
          this.showStatus('Account updated');
          this.closeModals();
          this.loadAccounts();
        },
        error: () => this.showStatus('Failed to update account', true)
      });
    } else {
      // Add new
      this.http.post(`${this.baseUrl}/api/accounts`, this.form).subscribe({
        next: () => {
          this.showStatus('Account added');
          this.closeModals();
          this.loadAccounts();
        },
        error: () => this.showStatus('Failed to add account', true)
      });
    }
  }

  saveToken() {
    if (!this.newToken || !this.editingAccount) {
      this.showStatus('Token is required', true);
      return;
    }

    this.http.put(`${this.baseUrl}/api/accounts/${this.editingAccount.id}`, { 
      access_token: this.newToken 
    }).subscribe({
      next: () => {
        this.showStatus('Token updated');
        this.closeModals();
        this.loadAccounts();
      },
      error: () => this.showStatus('Failed to update token', true)
    });
  }

  deleteAccount() {
    if (!this.editingAccount) return;

    this.http.delete(`${this.baseUrl}/api/accounts/${this.editingAccount.id}`).subscribe({
      next: () => {
        this.showStatus('Account deleted');
        this.closeModals();
        this.loadAccounts();
      },
      error: () => this.showStatus('Failed to delete account', true)
    });
  }

  // Login with Zerodha to auto-generate access token
  loginZerodha(acc: Account) {
    if (!acc.api_key) {
      this.showStatus('API key is required. Edit account first.', true);
      return;
    }
    // Open Zerodha login in new tab
    const loginUrl = `https://kite.zerodha.com/connect/login?v=3&api_key=${acc.api_key}`;
    window.open(loginUrl, '_blank');
    this.showStatus(`Opening Zerodha login for ${acc.name}...`);
  }

  showStatus(message: string, isError = false) {
    this.statusMessage = message;
    this.isError = isError;
    setTimeout(() => this.statusMessage = '', 3000);
  }
}
