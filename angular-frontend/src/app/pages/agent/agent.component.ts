import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../../core/api.service';
import { AgentResponse, TraceStep } from '../../core/api.models';

@Component({
  selector: 'app-agent',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page fade-up">
      <header class="page-head">
        <div>
          <h1>ReAct Agent</h1>
          <p class="sub">
            The LLM plans, calls tools, and reasons step-by-step. Watch the full trace.
          </p>
        </div>
        <div class="head-actions">
          @if (response()?.model) {
            <span class="chip">{{ response()!.model }}</span>
          }
          @if (response()?.cacheHit) {
            <span class="chip warn">cache hit</span>
          }
        </div>
      </header>

      <div class="agent-grid">
        <!-- LEFT: prompt + answer -->
        <div class="col">
          <div class="panel">
            <label>Ask the agent</label>
            <textarea
              [(ngModel)]="query"
              rows="4"
              placeholder="e.g. Compare metformin and semaglutide for a newly diagnosed T2DM patient."
            ></textarea>
            <div class="row" style="margin-top: 12px; justify-content: space-between;">
              <span class="chip accent">POST /api/agent</span>
              <button class="btn btn-primary" (click)="run()" [disabled]="!query.trim() || loading()">
                {{ loading() ? 'Reasoning…' : '🚀 Run agent' }}
              </button>
            </div>
          </div>

          @if (error()) {
            <div class="panel err">{{ error() }}</div>
          }

          @if (response(); as r) {
            <div class="panel">
              <div class="row" style="justify-content: space-between; margin-bottom: 12px;">
                <span class="chip accent">Answer</span>
                <span class="stats">
                  <span class="stat">
                    <b>{{ r.steps }}</b> steps
                  </span>
                  <span class="stat">
                    <b>{{ r.toolCallCount }}</b> tool calls
                  </span>
                </span>
              </div>
              <div class="answer" [innerText]="r.answer"></div>
            </div>
          }
        </div>

        <!-- RIGHT: trace -->
        <div class="col">
          <div class="panel trace-panel">
            <div class="row" style="justify-content: space-between; margin-bottom: 16px;">
              <div>
                <div class="trace-title">Reasoning trace</div>
                <div class="trace-sub">Every step returned from the agent</div>
              </div>
              @if (response()?.trace?.length) {
                <span class="chip">{{ response()!.trace.length }} entries</span>
              }
            </div>

            @if (!response() && !loading()) {
              <div class="empty">
                <div class="empty-icon">🧠</div>
                <p>Run a query to see the agent's reasoning here.</p>
              </div>
            }

            @if (loading()) {
              <div class="skeleton">
                <div></div><div></div><div></div><div></div>
              </div>
            }

            @if (response()?.trace?.length) {
              <ol class="trace">
                @for (step of response()!.trace; track $index) {
                  <li class="trace-step" [attr.data-type]="step.type" [style.animation-delay]="($index * 60) + 'ms'">
                    <div class="trace-marker">
                      <span class="trace-index">{{ $index + 1 }}</span>
                    </div>
                    <div class="trace-body">
                      <div class="trace-head">
                        <span class="chip" [ngClass]="typeChipClass(step.type)">{{ step.type }}</span>
                        @if (step.tool) {
                          <span class="chip accent">🔧 {{ step.tool }}</span>
                        }
                      </div>
                      @if (step.content) {
                        <pre class="trace-content mono">{{ step.content }}</pre>
                      }
                      @if (step.toolCalls?.length) {
                        <div class="tool-calls">
                          @for (tc of step.toolCalls; track $index) {
                            <pre class="mono tool-call">{{ pretty(tc) }}</pre>
                          }
                        </div>
                      }
                    </div>
                  </li>
                }
              </ol>
            }
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

      .agent-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
      @media (max-width: 1100px) { .agent-grid { grid-template-columns: 1fr; } }

      .col { display: flex; flex-direction: column; gap: 16px; }

      .stats { display: flex; gap: 16px; font-size: 13px; color: var(--text-dim); }
      .stat b { color: var(--text); font-size: 16px; margin-right: 4px; font-weight: 700; }

      .answer { white-space: pre-wrap; line-height: 1.6; font-size: 14.5px; }
      .err { color: var(--danger); background: rgba(248,113,113,0.06); border-color: rgba(248,113,113,0.3); }

      .trace-panel { max-height: calc(100vh - 140px); overflow-y: auto; }
      .trace-title { font-weight: 700; font-size: 15px; }
      .trace-sub { font-size: 12px; color: var(--text-mute); margin-top: 2px; }

      .empty { text-align: center; padding: 40px; color: var(--text-mute); }
      .empty-icon { font-size: 40px; margin-bottom: 8px; }

      .skeleton { display: grid; gap: 10px; }
      .skeleton div {
        height: 60px; border-radius: 10px;
        background: linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.09), rgba(255,255,255,0.04));
        background-size: 200% 100%;
        animation: shimmer 1.4s linear infinite;
      }
      @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

      .trace { list-style: none; margin: 0; padding: 0; position: relative; }
      .trace::before {
        content: '';
        position: absolute;
        left: 15px;
        top: 8px;
        bottom: 8px;
        width: 2px;
        background: linear-gradient(180deg, var(--accent), var(--accent-2), var(--accent-3));
        opacity: 0.4;
      }
      .trace-step {
        display: grid;
        grid-template-columns: 32px 1fr;
        gap: 12px;
        padding: 10px 0;
        animation: fade-up .4s ease both;
      }
      .trace-marker {
        position: relative;
        z-index: 1;
      }
      .trace-index {
        display: grid;
        place-items: center;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: var(--bg-1);
        border: 2px solid var(--accent-2);
        font-size: 12px;
        font-weight: 700;
        color: var(--accent);
      }
      .trace-body { min-width: 0; }
      .trace-head { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 6px; }
      .trace-content {
        margin: 0;
        padding: 10px 12px;
        border-radius: 10px;
        background: rgba(0,0,0,0.35);
        border: 1px solid var(--border);
        color: var(--text-dim);
        white-space: pre-wrap;
        word-break: break-word;
        max-height: 260px;
        overflow-y: auto;
      }
      .tool-calls { margin-top: 6px; display: flex; flex-direction: column; gap: 4px; }
      .tool-call {
        margin: 0;
        padding: 8px 10px;
        background: rgba(34,211,238,0.06);
        border: 1px solid rgba(34,211,238,0.2);
        border-radius: 8px;
        color: var(--text-dim);
        white-space: pre-wrap;
      }

      /* Type-based accent color for chip */
      .type-thought { color: var(--accent) !important; border-color: rgba(34,211,238,0.35) !important; background: rgba(34,211,238,0.08) !important; }
      .type-action { color: var(--accent-3) !important; border-color: rgba(168,85,247,0.35) !important; background: rgba(168,85,247,0.08) !important; }
      .type-observation { color: var(--warn) !important; border-color: rgba(251,191,36,0.35) !important; background: rgba(251,191,36,0.08) !important; }
      .type-final { color: var(--success) !important; border-color: rgba(52,211,153,0.35) !important; background: rgba(52,211,153,0.08) !important; }
    `,
  ],
})
export class AgentComponent {
  private api = inject(ApiService);

  query = 'Compare metformin and semaglutide for a newly diagnosed T2DM patient.';
  loading = signal(false);
  error = signal<string | null>(null);
  response = signal<AgentResponse | null>(null);

  run() {
    const q = this.query.trim();
    if (!q) return;
    this.loading.set(true);
    this.error.set(null);
    this.response.set(null);

    this.api.agentChat({ query: q }).subscribe({
      next: (r) => {
        this.response.set(r);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(e?.error?.error || e?.error?.detail || e?.message || 'Agent call failed');
        this.loading.set(false);
      },
    });
  }

  pretty(o: unknown): string {
    try { return JSON.stringify(o, null, 2); } catch { return String(o); }
  }

  typeChipClass(type: string): string {
    const t = (type || '').toLowerCase();
    if (t.includes('thought') || t.includes('reason')) return 'type-thought';
    if (t.includes('action') || t.includes('tool_use') || t.includes('call')) return 'type-action';
    if (t.includes('observation') || t.includes('tool_result')) return 'type-observation';
    if (t.includes('final') || t.includes('answer')) return 'type-final';
    return '';
  }

  // Handle both raw trace steps and typed ones (from either .NET or FastAPI shape).
  stepTypeLabel(step: TraceStep): string {
    return step.type;
  }
}
