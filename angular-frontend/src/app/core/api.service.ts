import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  AgentRequest,
  AgentResponse,
  ChatRequest,
  ChatResponse,
  CountResponse,
  HealthResponse,
  IngestRequest,
  IngestResponse,
  RawHealthResponse,
} from './api.models';

/**
 * All calls go through Angular's dev proxy (proxy.conf.json):
 *   /api/*  → .NET Gateway  (http://localhost:5000)
 *   /rag/*  → FastAPI RAG   (http://localhost:8000)
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  // ----- .NET Gateway -----
  chat(req: ChatRequest): Observable<ChatResponse> {
    return this.http.post<ChatResponse>('/api/chat', req);
  }

  chatHealth(): Observable<HealthResponse> {
    return this.http.get<HealthResponse>('/api/chat/health');
  }

  agentChat(req: AgentRequest): Observable<AgentResponse> {
    return this.http.post<AgentResponse>('/api/agent', req);
  }

  // ----- FastAPI (documents + raw health) -----
  ingestText(req: IngestRequest): Observable<IngestResponse> {
    return this.http.post<IngestResponse>('/rag/documents/ingest', req);
  }

  uploadFile(file: File): Observable<IngestResponse> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<IngestResponse>('/rag/documents/upload', form);
  }

  documentCount(): Observable<CountResponse> {
    return this.http.get<CountResponse>('/rag/documents/count');
  }

  ragHealth(): Observable<RawHealthResponse> {
    return this.http.get<RawHealthResponse>('/rag/health');
  }
}
