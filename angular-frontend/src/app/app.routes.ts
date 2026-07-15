import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'chat' },
  {
    path: 'chat',
    loadComponent: () => import('./pages/chat/chat.component').then((m) => m.ChatComponent),
    title: 'MediMind • Chat',
  },
  {
    path: 'agent',
    loadComponent: () => import('./pages/agent/agent.component').then((m) => m.AgentComponent),
    title: 'MediMind • Agent',
  },
  {
    path: 'documents',
    loadComponent: () =>
      import('./pages/documents/documents.component').then((m) => m.DocumentsComponent),
    title: 'MediMind • Documents',
  },
  {
    path: 'health',
    loadComponent: () => import('./pages/health/health.component').then((m) => m.HealthComponent),
    title: 'MediMind • Health',
  },
  { path: '**', redirectTo: 'chat' },
];
