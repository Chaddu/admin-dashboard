import { Component, signal } from '@angular/core';
import { LayoutComponent } from './layout/layout';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [LayoutComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App {
  protected readonly title = signal('admin-dashboard');
}
