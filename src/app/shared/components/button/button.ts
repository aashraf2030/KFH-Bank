import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-button',
  imports: [CommonModule],
  templateUrl: './button.html',
  styleUrl: './button.css',
})
export class ButtonComponent {
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() variant: 'primary' | 'secondary' = 'primary';
  @Input() disabled = false;
  @Input() loading = false;
  @Input() customClasses = '';
  @Output() btnClick = new EventEmitter<Event>();

  get buttonClasses(): string {
    const baseClasses = 'w-full py-4 px-6 rounded-xl font-medium text-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-kfh-green/50 flex items-center justify-center gap-2';
    
    let variantClasses = '';
    if (this.variant === 'primary') {
      if (this.disabled || this.loading) {
        variantClasses = 'bg-[#e0e0e0] text-[#a0a0a0] cursor-not-allowed opacity-90';
      } else {
        variantClasses = 'bg-kfh-green text-white hover:bg-kfh-green-hover active:scale-[0.98] shadow-sm';
      }
    } else if (this.variant === 'secondary') {
      if (this.disabled || this.loading) {
        variantClasses = 'border border-gray-200 text-gray-400 cursor-not-allowed opacity-90';
      } else {
        variantClasses = 'border border-kfh-green text-kfh-green bg-transparent hover:bg-kfh-green-light active:scale-[0.98]';
      }
    }

    return `${baseClasses} ${variantClasses} ${this.customClasses}`;
  }

  onClick(event: Event): void {
    if (this.disabled || this.loading) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    this.btnClick.emit(event);
  }
}

