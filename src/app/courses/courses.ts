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
  notAuthorized = signal(false);

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

  // Search functionality
  searchById = '';
  searchByInstructorId = '';
  searchResults = signal<CourseResponse[]>([]);
  searchError = signal('');
  isSearching = signal(false);
  showSearchResults = signal(false);

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('jwtToken') || '';
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
  }

  getCurrentUser(): { id: number; role: number } | null {
    const token = localStorage.getItem('jwtToken');
    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const roleString = payload.role || payload.userRole || '';
      let role = 0;
      if (roleString === 'Student' || roleString === '0') role = 0;
      else if (roleString === 'Instructor' || roleString === '1') role = 1;
      else if (roleString === 'Admin' || roleString === '2') role = 2;
      return {
        id: parseInt(payload.sub || payload.id || payload.userId || '0', 10),
        role: role
      };
    } catch (e) {
      console.error('Error decoding JWT:', e);
      return null;
    }
  }

  canEditCourse(): boolean {
    const currentUser = this.getCurrentUser();
    return currentUser ? currentUser.role >= 1 : false; // Instructor (1) and Admin (2)
  }

  canDeleteCourse(): boolean {
    const currentUser = this.getCurrentUser();
    return currentUser ? currentUser.role === 2 : false; // Admin only
  }

  canAddCourse(): boolean {
    const currentUser = this.getCurrentUser();
    return currentUser ? currentUser.role >= 1 : false; // Instructor (1) and Admin (2)
  }

  hasActions(): boolean {
    return this.canEditCourse() || this.canDeleteCourse();
  }

  // Search methods
  searchCourseById() {
    const idStr = String(this.searchById).trim();
    if (!idStr) {
      this.searchError.set('Please enter a course ID');
      return;
    }

    const id = parseInt(idStr, 10);
    if (isNaN(id) || id <= 0) {
      this.searchError.set('Course ID must be a positive number');
      return;
    }

    this.isSearching.set(true);
    this.searchError.set('');
    this.searchResults.set([]);
    this.http.get<Result<CourseResponse>>(`${this.baseUrl}/Course/${id}`, {
      headers: this.getHeaders(),
    }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.searchResults.set([response.data]);
          this.showSearchResults.set(true);
        } else {
          this.searchError.set(response.message || 'Course not found');
        }
        this.isSearching.set(false);
      },
      error: (err) => {
        this.searchError.set(err.error?.message || 'Error searching for course');
        this.isSearching.set(false);
      },
    });
  }

  searchCoursesByInstructorId() {
    const instructorIdStr = String(this.searchByInstructorId).trim();
    if (!instructorIdStr) {
      this.searchError.set('Please enter an instructor ID');
      return;
    }

    const instructorId = parseInt(instructorIdStr, 10);
    if (isNaN(instructorId) || instructorId <= 0) {
      this.searchError.set('Instructor ID must be a positive number');
      return;
    }

    this.isSearching.set(true);
    this.searchError.set('');
    this.searchResults.set([]);
    this.http.get<Result<CourseResponse[]>>(`${this.baseUrl}/Course/instructor/${instructorId}`, {
      headers: this.getHeaders(),
    }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.searchResults.set(response.data);
          this.showSearchResults.set(true);
        } else {
          this.searchError.set(response.message || 'No courses found for this instructor');
        }
        this.isSearching.set(false);
      },
      error: (err) => {
        this.searchError.set(err.error?.message || 'Error searching for courses');
        this.isSearching.set(false);
      },
    });
  }

  clearSearchResults() {
    this.showSearchResults.set(false);
    this.searchResults.set([]);
    this.searchError.set('');
    this.searchById = '';
    this.searchByInstructorId = '';
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
        if (err.status === 403) {
          this.notAuthorized.set(true);
          this.error.set('');
        } else {
          this.error.set('Error loading courses: ' + (err.error?.message || err.message));
        }
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
