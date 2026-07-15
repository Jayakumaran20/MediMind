import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../../core/api.service';
import { IngestResponse } from '../../core/api.models';

interface FeedItem {
  ok: boolean;
  msg: string;
  ts: number;
}

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page fade-up">
      <header class="page-head">
        <div>
          <h1>Knowledge Base</h1>
          <p class="sub">Ingest text or upload files into the vector store.</p>
        </div>
        <div class="head-actions">
          <button class="btn btn-ghost" (click)="refreshCount()" [disabled]="counting()">
            {{ counting() ? '…' : '↻ Refresh' }}
          </button>
        </div>
      </header>

      <!-- KPI strip -->
      <div class="kpi-strip">
        <div class="kpi panel">
          <div class="kpi-icon" style="background: linear-gradient(135deg, #22d3ee33, #6366f133);">📄</div>
          <div>
            <div class="kpi-value">{{ docCount() ?? '—' }}</div>
            <div class="kpi-label">Chunks in store</div>
          </div>
        </div>
        <div class="kpi panel">
          <div class="kpi-icon" style="background: linear-gradient(135deg, #a855f733, #6366f133);">📚</div>
          <div>
            <div class="kpi-value">{{ collection() || '—' }}</div>
            <div class="kpi-label">Collection</div>
          </div>
        </div>
        <div class="kpi panel">
          <div class="kpi-icon" style="background: linear-gradient(135deg, #34d39933, #22d3ee33);">✨</div>
          <div>
            <div class="kpi-value">{{ ingestedTotal() }}</div>
            <div class="kpi-label">Ingested this session</div>
          </div>
        </div>
      </div>

      <div class="doc-grid">
        <!-- Text ingest -->
        <div class="panel">
          <div class="row" style="justify-content: space-between; margin-bottom: 12px;">
            <div>
              <div class="section-title">Ingest text</div>
              <div class="section-sub">Paste one or more documents (separated by <span class="mono">---</span>)</div>
            </div>
            <span class="chip accent">POST /documents/ingest</span>
          </div>

          <textarea
            [(ngModel)]="ingestText"
            rows="8"
            placeholder="Paste medical text here… Use --- on its own line to separate multiple documents."
          ></textarea>

          <div class="row" style="margin-top: 12px;">
            <input
              [(ngModel)]="sourceTag"
              placeholder="Source tag (optional, e.g. 'internal-guideline-v3')"
              style="flex: 1;"
            />
            <button class="btn btn-primary" (click)="submitIngest()" [disabled]="!ingestText.trim() || ingesting()">
              {{ ingesting() ? 'Ingesting…' : '📥 Ingest' }}
            </button>
          </div>
        </div>

        <!-- File upload -->
        <div class="panel">
          <div class="row" style="justify-content: space-between; margin-bottom: 12px;">
            <div>
              <div class="section-title">Upload file</div>
              <div class="section-sub">.txt or .md files supported</div>
            </div>
            <span class="chip accent">POST /documents/upload</span>
          </div>

          <label
            class="dropzone"
            [class.dragover]="dragOver()"
            (dragover)="onDragOver($event)"
            (dragleave)="dragOver.set(false)"
            (drop)="onDrop($event)"
          >
            <input type="file" accept=".txt,.md" (change)="onFilePicked($event)" hidden #fileInput />
            <div class="drop-icon">📤</div>
            <div class="drop-title">Drop a file here</div>
            <div class="drop-sub">or click to browse (.txt / .md)</div>
            @if (pickedFile(); as f) {
              <div class="chip accent" style="margin-top: 12px;">{{ f.name }} · {{ (f.size / 1024) | number: '1.0-1' }} KB</div>
            }
          </label>

          <div class="row" style="margin-top: 12px; justify-content: flex-end;">
            <button class="btn" (click)="pickedFile.set(null)" [disabled]="!pickedFile()">Clear</button>
            <button class="btn btn-primary" (click)="submitUpload()" [disabled]="!pickedFile() || uploading()">
              {{ uploading() ? 'Uploading…' : '⬆ Upload' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Feed -->
      @if (feed().length) {
        <div class="panel" style="margin-top: 20px;">
          <div class="section-title" style="margin-bottom: 12px;">Activity</div>
          <ul class="feed">
            @for (f of feed(); track f.ts) {
              <li class="feed-item" [class.ok]="f.ok" [class.err]="!f.ok">
                <span class="feed-dot"></span>
                <span class="feed-msg">{{ f.msg }}</span>
                <span class="feed-ts mono">{{ f.ts | date: 'HH:mm:ss' }}</span>
              </li>
            }
          </ul>
        </div>
      }
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

      .kpi-strip {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
        margin-bottom: 20px;
      }
      @media (max-width: 800px) { .kpi-strip { grid-template-columns: 1fr; } }
      .kpi { display: flex; align-items: center; gap: 14px; padding: 20px; }
      .kpi-icon { width: 46px; height: 46px; border-radius: 12px; display: grid; place-items: center; font-size: 22px; border: 1px solid var(--border); }
      .kpi-value { font-size: 24px; font-weight: 700; letter-spacing: -0.3px; }
      .kpi-label { font-size: 12px; color: var(--text-mute); letter-spacing: 0.5px; text-transform: uppercase; }

      .doc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
      @media (max-width: 1000px) { .doc-grid { grid-template-columns: 1fr; } }

      .section-title { font-weight: 700; font-size: 15px; }
      .section-sub { font-size: 12px; color: var(--text-mute); margin-top: 2px; }

      .dropzone {
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        border: 2px dashed var(--border-strong);
        border-radius: 14px;
        padding: 30px;
        cursor: pointer;
        text-align: center;
        transition: all .15s ease;
        background: rgba(0,0,0,0.15);
      }
      .dropzone:hover, .dropzone.dragover {
        border-color: rgba(99,102,241,0.6);
        background: rgba(99,102,241,0.08);
      }
      .drop-icon { font-size: 36px; margin-bottom: 6px; }
      .drop-title { font-weight: 600; }
      .drop-sub { color: var(--text-mute); font-size: 13px; }

      .feed { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
      .feed-item {
        display: grid;
        grid-template-columns: 12px 1fr auto;
        gap: 12px;
        align-items: center;
        padding: 10px 12px;
        border-radius: 10px;
        background: rgba(0,0,0,0.2);
        border: 1px solid var(--border);
      }
      .feed-item .feed-dot { width: 8px; height: 8px; border-radius: 50%; }
      .feed-item.ok .feed-dot { background: var(--success); box-shadow: 0 0 0 3px rgba(52,211,153,0.15); }
      .feed-item.err .feed-dot { background: var(--danger); box-shadow: 0 0 0 3px rgba(248,113,113,0.15); }
      .feed-msg { font-size: 13.5px; }
      .feed-ts { color: var(--text-mute); font-size: 11px; }
    `,
  ],
})
export class DocumentsComponent {
  private api = inject(ApiService);

  ingestText = '';
  sourceTag = '';
  ingesting = signal(false);
  uploading = signal(false);
  counting = signal(false);
  dragOver = signal(false);
  pickedFile = signal<File | null>(null);

  docCount = signal<number | null>(null);
  collection = signal<string>('');
  ingestedTotal = signal<number>(0);
  feed = signal<FeedItem[]>([]);

  constructor() {
    this.refreshCount();
  }

  refreshCount() {
    this.counting.set(true);
    this.api.documentCount().subscribe({
      next: (r) => {
        this.docCount.set(r.count);
        this.collection.set(r.collection);
        this.counting.set(false);
      },
      error: () => this.counting.set(false),
    });
  }

  submitIngest() {
    const txt = this.ingestText.trim();
    if (!txt) return;
    const docs = txt.split(/\n\s*---\s*\n/).map((s) => s.trim()).filter(Boolean);
    const tag = this.sourceTag.trim();
    const metadatas = tag
      ? docs.map((_, i) => ({ source: `${tag}#${i + 1}` }))
      : undefined;

    this.ingesting.set(true);
    this.api.ingestText({ documents: docs, metadatas }).subscribe({
      next: (r) => {
        this.onIngestSuccess(r, `Ingested ${r.ingested_count} chunk(s) from ${docs.length} doc(s)`);
        this.ingestText = '';
      },
      error: (e) => this.onIngestError(e),
    });
  }

  submitUpload() {
    const file = this.pickedFile();
    if (!file) return;
    this.uploading.set(true);
    this.api.uploadFile(file).subscribe({
      next: (r) => {
        this.onIngestSuccess(r, `Uploaded "${file.name}" → ${r.ingested_count} chunk(s)`);
        this.pickedFile.set(null);
      },
      error: (e) => this.onIngestError(e),
    });
  }

  private onIngestSuccess(r: IngestResponse, msg: string) {
    this.ingesting.set(false);
    this.uploading.set(false);
    this.ingestedTotal.update((v) => v + r.ingested_count);
    this.feed.update((f) => [{ ok: true, msg, ts: Date.now() }, ...f].slice(0, 20));
    this.refreshCount();
  }

  private onIngestError(e: unknown) {
    this.ingesting.set(false);
    this.uploading.set(false);
    const msg =
      (e as { error?: { detail?: string; error?: string }; message?: string })?.error?.detail ||
      (e as { error?: { detail?: string; error?: string } })?.error?.error ||
      (e as { message?: string })?.message ||
      'Ingest failed';
    this.feed.update((f) => [{ ok: false, msg, ts: Date.now() }, ...f].slice(0, 20));
  }

  onDragOver(e: DragEvent) {
    e.preventDefault();
    this.dragOver.set(true);
  }

  onDrop(e: DragEvent) {
    e.preventDefault();
    this.dragOver.set(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) this.pickedFile.set(f);
  }

  onFilePicked(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) this.pickedFile.set(f);
  }
}
