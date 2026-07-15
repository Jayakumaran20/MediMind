import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';

import { ApiService } from '../../core/api.service';

interface ServiceCheck {
  key: string;
  label: string;
  endpoint: string;
  ok: boolean | null;
  latencyMs: number | null;
  detail: string;
  raw?: unknown;
}

@Component({
  selector: 'app-health',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="page fade-up">
      <header class="page-head">
        <div>
          <h1>Service Health</h1>
          <p class="sub">Live status across the MediMind stack.</p>
        </div>
        <div class="head-actions">
          <button class="btn btn-primary" (click)="runChecks()" [disabled]="running()">
            {{ running() ? 'Checking…' : '↻ Run checks' }}
          </button>
        </div>
      </header>

      <div class="hero panel">
        <div class="hero-inner">
          <div class="hero-badge" [class.ok]="allOk()" [class.err]="anyFail()">
            {{ allOk() ? '✓' : anyFail() ? '!' : '…' }}
          </div>
          <div>
            <div class="hero-status">{{ heroStatus() }}</div>
            <div class="hero-sub">Last checked · {{ lastCheck() | date: 'HH:mm:ss' }}</div>
          </div>
        </div>
        <div class="hero-tags">
          <span class="chip">Auto-refresh 30s</span>
          <span class="chip accent">{{ checks().length }} services</span>
        </div>
      </div>

      <div class="cards">
        @for (c of checks(); track c.key) {
          <div class="card panel">
            <div class="card-head">
              <div>
                <div class="card-title">{{ c.label }}</div>
                <div class="card-endpoint mono">{{ c.endpoint }}</div>
              </div>
              <span class="chip" [ngClass]="statusChip(c)">
                {{ c.ok === null ? 'checking' : c.ok ? 'healthy' : 'down' }}
              </span>
            </div>

            <div class="card-metrics">
              <div class="metric">
                <div class="metric-label">Latency</div>
                <div class="metric-value">
                  {{ c.latencyMs === null ? '—' : c.latencyMs + ' ms' }}
                </div>
                <div class="latency-bar">
                  <span
                    [style.width.%]="latencyPct(c.latencyMs)"
                    [class.slow]="(c.latencyMs ?? 0) > 400"
                    [class.mid]="(c.latencyMs ?? 0) > 150 && (c.latencyMs ?? 0) <= 400"
                  ></span>
                </div>
              </div>
              <div class="metric">
                <div class="metric-label">Detail</div>
                <div class="metric-value small">{{ c.detail || '—' }}</div>
              </div>
            </div>

            @if (c.raw) {
              <details class="raw">
                <summary>Raw response</summary>
                <pre class="mono">{{ pretty(c.raw) }}</pre>
              </details>
            }
          </div>
        }
      </div>

      <div class="panel arch">
        <div class="section-title" style="margin-bottom: 8px;">Architecture</div>
        <div class="arch-grid">
          <div class="node">
            <div class="node-icon">🌐</div>
            <div>
              <b>Angular UI</b>
              <div class="node-sub">this app</div>
            </div>
          </div>
          <div class="arrow">→</div>
          <div class="node">
            <div class="node-icon">⚙️</div>
            <div>
              <b>.NET Gateway</b>
              <div class="node-sub">:5000 · Redis cache</div>
            </div>
          </div>
          <div class="arrow">→</div>
          <div class="node">
            <div class="node-icon">🐍</div>
            <div>
              <b>FastAPI RAG</b>
              <div class="node-sub">:8000 · Chroma + Claude</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .page-head {
        display: flex; align-items: flex-end; justify-content: space-between;
        margin-bottom: 20px; gap: 16px; flex-wrap: wrap;
      }
      h1 { margin: 0; font-size: 28px; letter-spacing: -0.5px; }
      .sub { margin: 4px 0 0; color: var(--text-dim); }

      .hero {
        display: flex; justify-content: space-between; align-items: center;
        gap: 20px; margin-bottom: 20px; padding: 24px;
        background: linear-gradient(135deg, rgba(34,211,238,0.08), rgba(99,102,241,0.08));
        border-color: rgba(99,102,241,0.35);
      }
      .hero-inner { display: flex; align-items: center; gap: 16px; }
      .hero-badge {
        width: 56px; height: 56px; border-radius: 16px;
        display: grid; place-items: center;
        font-size: 26px; font-weight: 800;
        background: var(--panel-strong);
        border: 1px solid var(--border-strong);
        color: var(--text-mute);
      }
      .hero-badge.ok { background: rgba(52,211,153,0.15); color: var(--success); border-color: rgba(52,211,153,0.4); }
      .hero-badge.err { background: rgba(248,113,113,0.15); color: var(--danger); border-color: rgba(248,113,113,0.4); }
      .hero-status { font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
      .hero-sub { font-size: 12px; color: var(--text-mute); margin-top: 4px; }
      .hero-tags { display: flex; gap: 8px; }

      .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 20px; }
      .card { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
      .card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
      .card-title { font-weight: 700; font-size: 15px; }
      .card-endpoint { color: var(--text-mute); font-size: 11.5px; margin-top: 2px; }

      .card-metrics { display: grid; grid-template-columns: 1fr 1.2fr; gap: 16px; }
      .metric-label { font-size: 11px; color: var(--text-mute); text-transform: uppercase; letter-spacing: 0.5px; }
      .metric-value { font-size: 16px; font-weight: 700; margin-top: 4px; }
      .metric-value.small { font-size: 13px; font-weight: 500; color: var(--text-dim); }

      .latency-bar {
        margin-top: 8px;
        height: 6px;
        background: rgba(255,255,255,0.05);
        border-radius: 999px;
        overflow: hidden;
      }
      .latency-bar span {
        display: block;
        height: 100%;
        background: var(--success);
        border-radius: 999px;
        transition: width .4s ease;
      }
      .latency-bar span.mid { background: var(--warn); }
      .latency-bar span.slow { background: var(--danger); }

      .raw summary { cursor: pointer; color: var(--text-mute); font-size: 12px; }
      .raw pre { margin: 8px 0 0; padding: 10px 12px; background: rgba(0,0,0,0.35); border: 1px solid var(--border); border-radius: 8px; max-height: 200px; overflow: auto; white-space: pre-wrap; color: var(--text-dim); }

      .arch { padding: 24px; }
      .section-title { font-weight: 700; font-size: 15px; }
      .arch-grid {
        display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
        margin-top: 12px;
      }
      .node {
        flex: 1; min-width: 180px;
        display: flex; align-items: center; gap: 12px;
        padding: 14px;
        border-radius: 12px;
        background: rgba(0,0,0,0.2);
        border: 1px solid var(--border);
      }
      .node-icon {
        width: 40px; height: 40px; border-radius: 10px;
        display: grid; place-items: center;
        font-size: 20px;
        background: var(--grad-brand);
        color: #0b1224;
      }
      .node-sub { font-size: 11px; color: var(--text-mute); }
      .arrow { color: var(--text-mute); font-size: 22px; }
    `,
  ],
})
export class HealthComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);

  running = signal(false);
  lastCheck = signal<number>(Date.now());
  checks = signal<ServiceCheck[]>([
    { key: 'gw', label: '.NET Gateway', endpoint: 'GET /api/chat/health', ok: null, latencyMs: null, detail: '' },
    { key: 'rag', label: 'FastAPI RAG', endpoint: 'GET /rag/health', ok: null, latencyMs: null, detail: '' },
    { key: 'docs', label: 'Vector Store', endpoint: 'GET /rag/documents/count', ok: null, latencyMs: null, detail: '' },
  ]);

  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit() {
    this.runChecks();
    this.timer = setInterval(() => this.runChecks(), 30_000);
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  runChecks() {
    this.running.set(true);
    const t0 = performance.now();

    const results: ServiceCheck[] = this.checks().map((c) => ({ ...c, ok: null, latencyMs: null }));
    this.checks.set(results);

    const time = (start: number) => Math.round(performance.now() - start);

    // Gateway health
    const gwStart = performance.now();
    this.api.chatHealth().subscribe({
      next: (h) => this.update('gw', true, time(gwStart), `${h.model} · ${h.vectorStoreDocs} docs`, h),
      error: (e) => this.update('gw', false, time(gwStart), this.errorText(e)),
    });

    // RAG health
    const ragStart = performance.now();
    this.api.ragHealth().subscribe({
      next: (h) => this.update('rag', true, time(ragStart), `${h.model} · ${h.vector_store_docs} docs`, h),
      error: (e) => this.update('rag', false, time(ragStart), this.errorText(e)),
    });

    // Doc count
    const docStart = performance.now();
    this.api.documentCount().subscribe({
      next: (r) => this.update('docs', true, time(docStart), `${r.count} chunks · ${r.collection}`, r),
      error: (e) => this.update('docs', false, time(docStart), this.errorText(e)),
      complete: () => {
        this.running.set(false);
        this.lastCheck.set(Date.now());
        void t0;
      },
    });
  }

  private update(key: string, ok: boolean, latencyMs: number, detail: string, raw?: unknown) {
    this.checks.update((cs) =>
      cs.map((c) => (c.key === key ? { ...c, ok, latencyMs, detail, raw } : c)),
    );
    this.lastCheck.set(Date.now());
  }

  private errorText(e: unknown): string {
    const err = e as { status?: number; error?: { detail?: string; error?: string }; message?: string };
    return err?.error?.detail || err?.error?.error || (err?.status ? `HTTP ${err.status}` : err?.message || 'Failed');
  }

  statusChip(c: ServiceCheck): string {
    if (c.ok === null) return '';
    return c.ok ? 'ok' : 'err';
  }

  latencyPct(ms: number | null): number {
    if (ms === null) return 0;
    return Math.min(100, Math.round((ms / 1000) * 100));
  }

  allOk(): boolean {
    const cs = this.checks();
    return cs.length > 0 && cs.every((c) => c.ok === true);
  }

  anyFail(): boolean {
    return this.checks().some((c) => c.ok === false);
  }

  heroStatus(): string {
    if (this.running()) return 'Running checks…';
    if (this.allOk()) return 'All systems operational';
    if (this.anyFail()) return 'One or more services degraded';
    return 'Waiting for first check';
  }

  pretty(o: unknown): string {
    try { return JSON.stringify(o, null, 2); } catch { return String(o); }
  }
}
