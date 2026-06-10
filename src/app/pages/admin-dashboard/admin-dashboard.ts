import { Component, signal, inject, OnInit, OnDestroy, ChangeDetectionStrategy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/components/button/button';
import { io } from 'socket.io-client';
import { API_BASE } from '../../shared/config';

@Component({
  selector: 'app-admin-dashboard',
  imports: [CommonModule, FormsModule, ButtonComponent],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private ngZone = inject(NgZone);

  adminEmail = signal('');
  clients = signal<any[]>([]);
  selectedQuestions = signal<{ [clientId: string]: string }>({});
  
  // Available questions
  questionsList = [
    'ما هو رقمك المفضل ؟',
    'ما هو مكان ولادتك ؟',
    'ما هو حلم طفولتك ؟',
    'ما هي رياضتك المفضلة ؟'
  ];

  // Map of client-loading states for actions (assign/approve/reject)
  actionLoading = signal<{ [clientId: string]: boolean }>({});

  private pollInterval: any;
  private socket: any;

  ngOnInit(): void {
    const email = localStorage.getItem('admin_email');
    if (!email) {
      this.router.navigate(['/admin/login']);
      return;
    }
    this.adminEmail.set(email);

    // Initial fetch
    this.fetchClients();

    // Initialize WebSockets for real-time dashboard updates
    console.log('Admin connecting to WebSocket server...');
    this.socket = io(API_BASE);
    
    this.socket.on('connect', () => {
      console.log('Admin WebSocket connected successfully.');
    });

    this.socket.on('admin_update', () => {
      console.log('Real-time admin_update received. Refreshing list...');
      this.ngZone.run(() => {
        this.fetchClients();
      });
    });

    // Fallback polling every 5 seconds (less frequent due to sockets)
    this.pollInterval = setInterval(() => {
      this.fetchClients();
    }, 5000);
  }

  ngOnDestroy(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  async fetchClients(): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/user/admin/clients`);
      if (!response.ok) throw new Error('Failed to fetch clients');
      
      const data = await response.json();
      
      // Sort clients by creation date (newest first)
      const sortedClients = data.sort((a: any, b: any) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      this.clients.set(sortedClients);

      // Initialize selected questions for new clients
      const currentSelected = { ...this.selectedQuestions() };
      let updated = false;
      for (const client of sortedClients) {
        if (client.status === 'PENDING' && !currentSelected[client.id]) {
          currentSelected[client.id] = this.questionsList[0] || '';
          updated = true;
        }
      }
      if (updated) {
        this.selectedQuestions.set(currentSelected);
      }

    } catch (err) {
      console.error('Error fetching clients:', err);
    }
  }

  onQuestionSelect(clientId: string, question: string): void {
    const current = { ...this.selectedQuestions() };
    current[clientId] = question;
    this.selectedQuestions.set(current);
  }

  async assignQuestion(clientId: string): Promise<void> {
    const question = this.selectedQuestions()[clientId];
    if (!question) return;

    this.setLoading(clientId, true);

    try {
      const response = await fetch(`${API_BASE}/user/admin/assign-question`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clientId, question })
      });

      if (!response.ok) throw new Error('Failed to assign question');

      await this.fetchClients();
    } catch (err) {
      console.error('Error assigning question:', err);
      alert('حدث خطأ أثناء إرسال السؤال');
    } finally {
      this.setLoading(clientId, false);
    }
  }

  async verifyAnswer(clientId: string, approve: boolean): Promise<void> {
    this.setLoading(clientId, true);

    try {
      const response = await fetch(`${API_BASE}/user/admin/verify-answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clientId, approve })
      });

      if (!response.ok) throw new Error('Failed to verify answer');

      await this.fetchClients();
    } catch (err) {
      console.error('Error verifying answer:', err);
      alert('حدث خطأ أثناء معالجة القرار');
    } finally {
      this.setLoading(clientId, false);
    }
  }

  logout(): void {
    localStorage.removeItem('admin_email');
    this.router.navigate(['/admin/login']);
  }

  private setLoading(clientId: string, isLoading: boolean): void {
    const current = { ...this.actionLoading() };
    current[clientId] = isLoading;
    this.actionLoading.set(current);
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'PENDING':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'WAITING_ANSWER':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'ANSWERED':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'APPROVED':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'REJECTED':
        return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      default:
        return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'PENDING':
        return 'في انتظار اختيار السؤال';
      case 'WAITING_ANSWER':
        return 'في انتظار إجابة العميل';
      case 'ANSWERED':
        return 'تمت الإجابة - مطلوب التحقق';
      case 'APPROVED':
        return 'تم قبول الدخول';
      case 'REJECTED':
        return 'تم رفض الإجابة';
      default:
        return status;
    }
  }
}
