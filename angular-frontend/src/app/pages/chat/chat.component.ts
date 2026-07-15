import { CommonModule } from '@angular/common';
import { Component, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../../core/api.service';
import { ChatResponse, Source } from '../../core/api.models';

interface Turn {
  role: 'user' | 'assistant';
  text: string;
  sources?: Source[];
  model?: string;
  cacheHit?: boolean;
  ts: number;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page fade-up">
      <header class="page-head">
        <div>
          <h1>Clinical Q&amp;A</h1>
          <p class="sub">Retrieval-augmented answers grounded in your medical corpus.</p>
        </div>
        <div class="head-actions">
          <span class="chip accent" *ngIf="conversationId()">
            conv · {{ conversationId()!.slice(0, 8) }}
          </span>
          <button class="btn btn-ghost" (click)="reset()" [disabled]="!turns().length">
            🧹 Clear
          </button>
        </div>
      </header>

      <div class="chat-wrapper panel">
        <div class="chat-scroll" #scroll>
          @if (!turns().length) {
            <div class="empty">
              <div class="empty-icon">💬</div>
              <h3>Ask a clinical question</h3>
              <p>Try one of these to get started:</p>
              <div class="starters">
                @for (s of starters; track s) {
                  <button class="starter" (click)="ask(s)">{{ s }}</button>
                }
              </div>
            </div>
          }

          @for (t of turns(); track t.ts) {
            <div class="turn" [class.user]="t.role === 'user'" [class.assistant]="t.role === 'assistant'">
              <div class="avatar">{{ t.role === 'user' ? '🧑' : '🩺' }}</div>
              <div class="bubble">
                <div class="bubble-meta">
                  <span class="role">{{ t.role === 'user' ? 'You' : 'MediMind' }}</span>
                  @if (t.cacheHit) { <span class="chip warn">cache hit</span> }
                  @if (t.model) { <span class="chip">{{ t.model }}</span> }
                </div>
                <div class="bubble-body" [innerText]="t.text"></div>

                @if (t.sources?.length) {
                  <details class="sources">
                    <summary>{{ t.sources!.length }} source{{ t.sources!.length === 1 ? '' : 's' }}</summary>
                    @for (src of t.sources; track $index) {
                      <div class="source">
                        <div class="source-head">
                          <span class="chip accent">#{{ $index + 1 }}</span>
                          @if (src.score != null) {
                            <span class="chip">score {{ src.score | number: '1.3-3' }}</span>
                          }
                          @if (src.metadata['source']) {
                            <span class="chip">{{ src.metadata['source'] }}</span>
                          }
                          @if (src.metadata['title']) {
                            <span class="chip">{{ src.metadata['title'] }}</span>
                          }
                        </div>
                        <div class="source-body mono">{{ src.content }}</div>
                      </div>
                    }
                  </details>
                }
              </div>
            </div>
          }

          @if (loading()) {
            <div class="turn assistant">
              <div class="avatar">🩺</div>
              <div class="bubble">
                <div class="typing">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          }

          @if (error()) {
            <div class="err">{{ error() }}</div>
          }
        </div>

        <form class="composer" (ngSubmit)="submit()">
          <div class="composer-controls">
            <label class="topk">
              Top-K
              <input type="number" min="1" max="10" [(ngModel)]="topK" name="topK" />
            </label>
          </div>
          <textarea
            #input
            [(ngModel)]="query"
            name="query"
            rows="2"
            placeholder="Ask about symptoms, treatments, dosages…"
            (keydown.enter)="onEnter($event)"
          ></textarea>
          <button class="btn btn-primary send" type="submit" [disabled]="!query.trim() || loading()">
            {{ loading() ? 'Thinking…' : 'Send ↵' }}
          </button>
        </form>
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
      .head-actions { display: flex; gap: 8px; align-items: center; }

      .chat-wrapper { display: flex; flex-direction: column; padding: 0; overflow: hidden; }
      .chat-scroll { padding: 24px; min-height: 460px; max-height: calc(100vh - 320px); overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }

      .empty {
        text-align: center; margin: auto; padding: 40px 20px; color: var(--text-dim);
      }
      .empty-icon { font-size: 48px; margin-bottom: 12px; }
      .empty h3 { margin: 0 0 6px; color: var(--text); }
      .starters { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 16px; }
      .starter {
        padding: 10px 14px;
        border-radius: 12px;
        border: 1px solid var(--border);
        background: var(--panel);
        color: var(--text-dim);
        cursor: pointer;
        font-size: 13px;
        transition: all .15s ease;
      }
      .starter:hover { color: var(--text); border-color: rgba(99,102,241,0.4); background: rgba(99,102,241,0.08); }

      .turn { display: flex; gap: 12px; animation: fade-up .3s ease both; }
      .turn.user { flex-direction: row-reverse; }
      .avatar {
        width: 36px; height: 36px; border-radius: 10px;
        background: var(--panel-strong);
        display: grid; place-items: center; font-size: 18px;
        border: 1px solid var(--border);
        flex-shrink: 0;
      }
      .bubble {
        max-width: 78%; padding: 14px 16px; border-radius: 14px;
        background: var(--panel); border: 1px solid var(--border);
        display: flex; flex-direction: column; gap: 8px;
      }
      .turn.user .bubble {
        background: linear-gradient(135deg, rgba(34,211,238,0.16), rgba(99,102,241,0.16));
        border-color: rgba(99,102,241,0.35);
      }
      .bubble-meta { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-mute); }
      .role { font-weight: 600; color: var(--text); }
      .bubble-body { white-space: pre-wrap; line-height: 1.55; font-size: 14.5px; }

      .sources { border-top: 1px dashed var(--border); padding-top: 8px; margin-top: 4px; }
      .sources summary { cursor: pointer; font-size: 12px; color: var(--text-dim); }
      .source { padding: 10px 12px; margin-top: 8px; border-radius: 10px; background: rgba(0,0,0,0.25); border: 1px solid var(--border); }
      .source-head { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 6px; }
      .source-body { color: var(--text-dim); max-height: 160px; overflow-y: auto; white-space: pre-wrap; }

      .typing { display: flex; gap: 6px; padding: 4px 4px; }
      .typing span {
        width: 8px; height: 8px; border-radius: 50%;
        background: var(--text-mute);
        animation: pulse-dot 1s ease-in-out infinite;
      }
      .typing span:nth-child(2) { animation-delay: .2s; }
      .typing span:nth-child(3) { animation-delay: .4s; }

      .err { color: var(--danger); background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.3); padding: 10px 14px; border-radius: 10px; font-size: 13px; }

      .composer {
        border-top: 1px solid var(--border);
        padding: 16px 24px;
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 12px;
        align-items: center;
        background: rgba(0,0,0,0.15);
      }
      .composer textarea { min-height: 46px; }
      .composer-controls { display: flex; align-items: center; gap: 8px; }
      .topk { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--text-mute); margin: 0; letter-spacing: 1px; }
      .topk input { width: 60px; padding: 8px 10px; text-align: center; }
      .send { min-width: 120px; }
      @media (max-width: 700px) {
        .composer { grid-template-columns: 1fr; }
        .send { width: 100%; }
      }
    `,
  ],
})
export class ChatComponent {
  private api = inject(ApiService);
  @ViewChild('scroll') scrollEl?: ElementRef<HTMLDivElement>;

  turns = signal<Turn[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  conversationId = signal<string | null>(null);

  query = '';
  topK: number | null = 4;

  starters = [
    'What are the common side effects of ACE inhibitors?',
    'How is Type 2 diabetes typically diagnosed?',
    'Explain the mechanism of statins.',
    'What is the recommended workup for chest pain?',
  ];

  onEnter(e: Event) {
    const ke = e as KeyboardEvent;
    if (!ke.shiftKey) {
      ke.preventDefault();
      this.submit();
    }
  }

  ask(q: string) {
    this.query = q;
    this.submit();
  }

  submit() {
    const q = this.query.trim();
    if (!q || this.loading()) return;
    this.error.set(null);
    this.turns.update((t) => [...t, { role: 'user', text: q, ts: Date.now() }]);
    this.query = '';
    this.loading.set(true);
    this.scrollSoon();

    this.api
      .chat({
        query: q,
        topK: this.topK ?? undefined,
        conversationId: this.conversationId(),
      })
      .subscribe({
        next: (res: ChatResponse) => {
          if (res.conversationId) this.conversationId.set(res.conversationId);
          this.turns.update((t) => [
            ...t,
            {
              role: 'assistant',
              text: res.answer,
              sources: res.sources,
              model: res.model,
              cacheHit: res.cacheHit,
              ts: Date.now(),
            },
          ]);
          this.loading.set(false);
          this.scrollSoon();
        },
        error: (e) => {
          this.error.set(e?.error?.error || e?.message || 'Request failed');
          this.loading.set(false);
        },
      });
  }

  reset() {
    this.turns.set([]);
    this.conversationId.set(null);
    this.error.set(null);
  }

  private scrollSoon() {
    setTimeout(() => {
      const el = this.scrollEl?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 30);
  }
}
