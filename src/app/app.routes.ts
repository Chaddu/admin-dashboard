import { Routes } from '@angular/router';
import { Dashboard } from './dashboard/dashboard';
import { Courses } from './courses/courses';
import { Users } from './users/users';
import { Assignments } from './assignments/assignments';
import { Enrollments } from './enrollments/enrollments';

export const routes: Routes = [
  { path: '', component: Dashboard },
  { path: 'courses', component: Courses },
  { path: 'users', component: Users },
  { path: 'assignments', component: Assignments },
  { path: 'enrollments', component: Enrollments }
];