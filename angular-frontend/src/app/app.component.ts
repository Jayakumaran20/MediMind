import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { ApiService } from './core/api.service';

interface NavItem {
  path: string;
  label: string;
  desc: string;
  icon: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-logo">🩺</div>
          <div>
            <div class="brand-name">MediMind</div>
            <div class="brand-sub">Clinical AI Assistant</div>
          </div>
        </div>

        <nav class="nav">
          @for (item of nav; track item.path) {
            <a
              class="nav-item"
              [routerLink]="['/', item.path]"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: false }"
            >
              <span class="nav-icon">{{ item.icon }}</span>
              <span class="nav-text">
                <span class="nav-label">{{ item.label }}</span>
                <span class="nav-desc">{{ item.desc }}</span>
              </span>
            </a>
          }
        </nav>

        <div class="status-card">
          <div class="status-row">
            <span class="dot" [class.ok]="gatewayOk()" [class.err]="gatewayOk() === false"></span>
            <span>Gateway</span>
            <span class="status-value">{{ gatewayLabel() }}</span>
          </div>
          <div class="status-row">
            <span class="dot" [class.ok]="ragOk()" [class.err]="ragOk() === false"></span>
            <span>RAG Service</span>
            <span class="status-value">{{ ragLabel() }}</span>
          </div>
          <div class="model-line" *ngIf="model()">Model · {{ model() }}</div>
        </div>
      </aside>

      <main class="content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [
    `
      .shell {
        display: grid;
        grid-template-columns: 280px 1fr;
        min-height: 100vh;
      }
      @media (max-width: 900px) {
        .shell { grid-template-columns: 1fr; }
      }
      .sidebar {
        border-right: 1px solid var(--border);
        padding: 24px 18px;
        display: flex;
        flex-direction: column;
        gap: 24px;
        background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.005));
        position: sticky;
        top: 0;
        height: 100vh;
        overflow-y: auto;
      }
      @media (max-width: 900px) {
        .sidebar { position: static; height: auto; }
      }
      .brand {
        display: flex;
        gap: 12px;
        align-items: center;
        padding: 4px 8px;
      }
      .brand-logo {
        width: 44px;
        height: 44px;
        border-radius: 12px;
        display: grid;
        place-items: center;
        font-size: 22px;
        background: var(--grad-brand);
        box-shadow: 0 10px 30px -10px rgba(99,102,241,0.6);
      }
      .brand-name { font-weight: 800; letter-spacing: -0.3px; font-size: 18px; }
      .brand-sub { font-size: 11px; color: var(--text-mute); letter-spacing: 1.5px; text-transform: uppercase; }

      .nav { display: flex; flex-direction: column; gap: 4px; }
      .nav-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 12px;
        border-radius: 12px;
        color: var(--text-dim);
        transition: background .15s ease, color .15s ease, transform .15s ease;
        cursor: pointer;
        border: 1px solid transparent;
      }
      .nav-item:hover {
        background: rgba(255,255,255,0.04);
        color: var(--text);
      }
      .nav-item.active {
        background: linear-gradient(135deg, rgba(34,211,238,0.14), rgba(99,102,241,0.14));
        color: var(--text);
        border-color: rgba(99,102,241,0.35);
        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.05);
      }
      .nav-icon {
        width: 34px; height: 34px;
        border-radius: 10px;
        background: var(--panel-strong);
        display: grid; place-items: center;
        font-size: 16px;
      }
      .nav-text { display: flex; flex-direction: column; }
      .nav-label { font-weight: 600; font-size: 14px; }
      .nav-desc { font-size: 11px; color: var(--text-mute); }

      .status-card {
        margin-top: auto;
        padding: 14px;
        border-radius: 14px;
        background: var(--panel);
        border: 1px solid var(--border);
        display: flex;
        flex-direction: column;
        gap: 8px;
        font-size: 13px;
      }
      .status-row { display: flex; align-items: center; gap: 8px; }
      .status-value { margin-left: auto; color: var(--text-mute); font-size: 12px; }
      .dot {
        width: 8px; height: 8px; border-radius: 50%;
        background: var(--text-mute);
        box-shadow: 0 0 0 3px rgba(255,255,255,0.03);
      }
      .dot.ok { background: var(--success); box-shadow: 0 0 0 3px rgba(52,211,153,0.15); animation: pulse-dot 2s ease-in-out infinite; }
      .dot.err { background: var(--danger); box-shadow: 0 0 0 3px rgba(248,113,113,0.15); }
      .model-line {
        font-size: 11px;
        color: var(--text-mute);
        border-top: 1px dashed var(--border);
        padding-top: 8px;
        letter-spacing: 0.4px;
      }

      .content { padding: 32px 40px; min-width: 0; }
      @media (max-width: 900px) { .content { padding: 20px; } }
    `,
  ],
})
export class AppComponent implements OnInit {
  private api = inject(ApiService);

  nav: NavItem[] = [
    { path: 'chat', label: 'Chat', desc: 'RAG Q&A', icon: '💬' },
    { path: 'agent', label: 'Agent', desc: 'ReAct reasoning', icon: '🤖' },
    { path: 'documents', label: 'Documents', desc: 'Ingest knowledge', icon: '📚' },
    { path: 'health', label: 'Health', desc: 'Service status', icon: '📊' },
  ];

  gatewayOk = signal<boolean | null>(null);
  ragOk = signal<boolean | null>(null);
  model = signal<string>('');

  ngOnInit(): void {
    this.api.chatHealth().subscribe({
      next: (h) => {
        this.gatewayOk.set(h.status?.toLowerCase() === 'ok');
        this.model.set(h.model);
      },
      error: () => this.gatewayOk.set(false),
    });
    this.api.ragHealth().subscribe({
      next: (h) => this.ragOk.set(h.status?.toLowerCase() === 'ok'),
      error: () => this.ragOk.set(false),
    });
  }

  gatewayLabel(): string {
    const v = this.gatewayOk();
    if (v === null) return 'checking…';
    return v ? 'online' : 'offline';
  }

  ragLabel(): string {
    const v = this.ragOk();
    if (v === null) return 'checking…';
    return v ? 'online' : 'offline';
  }
}
