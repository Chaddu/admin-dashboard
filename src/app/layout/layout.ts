import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './layout.html',
  styleUrls: ['./layout.css']
})
export class LayoutComponent implements OnInit, OnDestroy {
  isLoggedIn = signal(false);
  private checkInterval: any;

  ngOnInit() {
    this.checkLoginStatus();
    // Check for login status every second
    this.checkInterval = setInterval(() => this.checkLoginStatus(), 1000);
  }

  ngOnDestroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }

  checkLoginStatus() {
    const token = localStorage.getItem('jwtToken');
    this.isLoggedIn.set(!!token);
  }

  logout() {
    localStorage.removeItem('jwtToken');
    this.isLoggedIn.set(false);
    window.location.href = '/';
  }
}