import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login';

export const routes: Routes = [
  { path: '', component: LoginComponent },
  { 
    path: 'admin/login', 
    loadComponent: () => import('./pages/admin-login/admin-login').then(m => m.AdminLoginComponent) 
  },
  { 
    path: 'admin/dashboard', 
    loadComponent: () => import('./pages/admin-dashboard/admin-dashboard').then(m => m.AdminDashboardComponent) 
  },
  { path: '**', redirectTo: '' }
];

