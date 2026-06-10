import { Component, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/components/button/button';
import { InputComponent } from '../../shared/components/input/input';
import { API_BASE } from '../../shared/config';

@Component({
  selector: 'app-admin-login',
  imports: [CommonModule, FormsModule, ButtonComponent, InputComponent],
  templateUrl: './admin-login.html',
  styleUrl: './admin-login.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminLoginComponent {
  private router = inject(Router);

  email = signal('');
  password = signal('');
  loading = signal(false);
  errorMessage = signal('');

  get isFormValid(): boolean {
    return this.email().trim().length > 0 && this.password().trim().length > 0;
  }

  async onSubmit(): Promise<void> {
    if (!this.isFormValid) return;

    this.loading.set(true);
    this.errorMessage.set('');

    try {
      const response = await fetch(`${API_BASE}/user/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: this.email(),
          password: this.password()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'بيانات الدخول غير صحيحة');
      }

      // Store admin session
      localStorage.setItem('admin_email', data.user.email);
      this.router.navigate(['/admin/dashboard']);
    } catch (err: any) {
      this.errorMessage.set(err.message || 'حدث خطأ أثناء الاتصال بالخادم');
    } finally {
      this.loading.set(false);
    }
  }
}
