import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';

interface CourseResponse {
  id: number;
  title: string;
  description: string;
  instructorId: number;
}

interface Result<T> {
  success: boolean;
  data?: T;
  message?: string;
}

@Component({
  selector: 'app-courses',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './courses.html',
  styleUrls: ['./courses.css'],
})
export class Courses implements OnInit {
  private readonly baseUrl = 'https://localhost:7108/api';

  courses = signal<CourseResponse[]>([]);
  isLoading = signal(false);
  error = signal('');

  // Add course modal
  addModalOpen = signal(false);
  newCourseTitle = '';
  newCourseDescription = '';
  newCourseInstructorId = '';
  isSubmitting = signal(false);
  submitError = signal('');
  submitMessage = signal('');

  // Edit course modal
  editModalOpen = signal(false);
  editingCourse: CourseResponse | null = null;
  editTitle = '';
  editDescription = '';
  editInstructorId = '';
  isEditing = signal(false);
  editError = signal('');
  editMessage = signal('');

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('jwtToken') || '';
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
  }

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadCourses();
  }

  loadCourses() {
    this.isLoading.set(true);
    this.error.set('');

    this.http.get<Result<CourseResponse[]>>(`${this.baseUrl}/Course`, {
      headers: this.getHeaders(),
    }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.courses.set(response.data);
        } else {
          this.error.set(response.message || 'Failed to load courses');
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set('Error loading courses: ' + (err.error?.message || err.message));
        this.isLoading.set(false);
      },
    });
  }

  toggleAddModal(open?: boolean) {
    this.addModalOpen.set(open ?? !this.addModalOpen());
    this.submitError.set('');
    this.submitMessage.set('');
    this.newCourseTitle = '';
    this.newCourseDescription = '';
    this.newCourseInstructorId = '';
  }

  submitCourse() {
    if (!this.newCourseTitle.trim()) {
      this.submitError.set('Title is required');
      return;
    }

    this.isSubmitting.set(true);
    this.submitError.set('');
    this.submitMessage.set('');

    const courseData = {
      title: this.newCourseTitle,
      description: this.newCourseDescription,
      instuctorId: this.newCourseInstructorId ? parseInt(this.newCourseInstructorId) : 0,
    };

    this.http.post<Result<CourseResponse>>(`${this.baseUrl}/Course`, courseData, {
      headers: this.getHeaders(),
    }).subscribe({
      next: (response) => {
        if (response.success) {
          this.submitMessage.set('Course created successfully!');
          setTimeout(() => {
            this.toggleAddModal(false);
            this.loadCourses();
          }, 1000);
        } else {
          this.submitError.set(response.message || 'Failed to create course');
        }
        this.isSubmitting.set(false);
      },
      error: (err) => {
        this.submitError.set(err.error?.message || 'Error creating course');
        this.isSubmitting.set(false);
      },
    });
  }

  openEditModal(course: CourseResponse) {
    this.editingCourse = course;
    this.editTitle = course.title;
    this.editDescription = course.description;
    this.editInstructorId = course.instructorId.toString();
    this.editModalOpen.set(true);
    this.editError.set('');
    this.editMessage.set('');
  }

  toggleEditModal(open?: boolean) {
    this.editModalOpen.set(open ?? !this.editModalOpen());
    if (!open) {
      this.editingCourse = null;
    }
  }

  updateCourse() {
    if (!this.editingCourse) return;

    if (!this.editTitle.trim()) {
      this.editError.set('Title is required');
      return;
    }

    this.isEditing.set(true);
    this.editError.set('');
    this.editMessage.set('');

    const courseData = {
      title: this.editTitle,
      description: this.editDescription,
      instructorId: this.editInstructorId ? parseInt(this.editInstructorId) : 0,
    };

    this.http.put<Result<any>>(`${this.baseUrl}/Course/${this.editingCourse.id}`, courseData, {
      headers: this.getHeaders(),
    }).subscribe({
      next: (response) => {
        if (response.success) {
          this.editMessage.set('Course updated successfully!');
          setTimeout(() => {
            this.toggleEditModal(false);
            this.loadCourses();
          }, 1000);
        } else {
          this.editError.set(response.message || 'Failed to update course');
        }
        this.isEditing.set(false);
      },
      error: (err) => {
        this.editError.set(err.error?.message || 'Error updating course');
        this.isEditing.set(false);
      },
    });
  }

  deleteCourse(id: number) {
    if (!confirm('Are you sure you want to delete this course?')) return;

    this.http.delete<Result<any>>(`${this.baseUrl}/Course/${id}`, {
      headers: this.getHeaders(),
    }).subscribe({
      next: (response) => {
        if (response.success) {
          this.loadCourses();
        } else {
          alert(response.message || 'Failed to delete course');
        }
      },
      error: (err) => {
        alert(err.error?.message || 'Error deleting course');
      },
    });
  }
}
