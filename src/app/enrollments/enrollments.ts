import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';

interface EnrollmentResponse {
  id: number;
  userId: number;
  courseId: number;
  enrolledAt: string;
}

interface Result<T> {
  success: boolean;
  data?: T;
  message?: string;
}

@Component({
  selector: 'app-enrollments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './enrollments.html',
  styleUrls: ['./enrollments.css'],
})
export class Enrollments implements OnInit {
  private readonly baseUrl = 'https://localhost:7108/api';

  enrollments = signal<EnrollmentResponse[]>([]);
  isLoading = signal(false);
  error = signal('');

  // Add enrollment modal
  addModalOpen = signal(false);
  newUserId = '';
  newCourseId = '';
  isSubmitting = signal(false);
  submitError = signal('');
  submitMessage = signal('');

  // Edit enrollment modal
  editModalOpen = signal(false);
  editingEnrollment: EnrollmentResponse | null = null;
  editUserId = '';
  editCourseId = '';
  isEditing = signal(false);
  editError = signal('');
  editMessage = signal('');

  // Delete confirmation modal
  deleteModalOpen = signal(false);
  deletingEnrollmentId: number | null = null;

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('jwtToken') || '';
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
  }

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadEnrollments();
  }

  loadEnrollments() {
    this.isLoading.set(true);
    this.error.set('');

    this.http.get<Result<EnrollmentResponse[]>>(`${this.baseUrl}/Enrollment`, {
      headers: this.getHeaders(),
    }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.enrollments.set(response.data);
        } else {
          this.error.set(response.message || 'Failed to load enrollments');
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set('Error loading enrollments: ' + (err.error?.message || err.message));
        this.isLoading.set(false);
      },
    });
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  toggleAddModal(open?: boolean) {
    this.addModalOpen.set(open ?? !this.addModalOpen());
    this.submitError.set('');
    this.submitMessage.set('');
    this.newUserId = '';
    this.newCourseId = '';
  }

  submitEnrollment() {
    if (!this.newUserId) {
      this.submitError.set('User ID is required');
      return;
    }
    if (!this.newCourseId) {
      this.submitError.set('Course ID is required');
      return;
    }

    this.isSubmitting.set(true);
    this.submitError.set('');
    this.submitMessage.set('');

    const enrollmentData = {
      userId: parseInt(this.newUserId),
      courseId: parseInt(this.newCourseId),
    };

    this.http.post<Result<EnrollmentResponse>>(`${this.baseUrl}/Enrollment`, enrollmentData, {
      headers: this.getHeaders(),
    }).subscribe({
      next: (response) => {
        if (response.success) {
          this.submitMessage.set('Enrollment created successfully!');
          setTimeout(() => {
            this.toggleAddModal(false);
            this.loadEnrollments();
          }, 1000);
        } else {
          this.submitError.set(response.message || 'Failed to create enrollment');
        }
        this.isSubmitting.set(false);
      },
      error: (err) => {
        this.submitError.set(err.error?.message || 'Error creating enrollment');
        this.isSubmitting.set(false);
      },
    });
  }

  openEditModal(enrollment: EnrollmentResponse) {
    this.editingEnrollment = enrollment;
    this.editUserId = enrollment.userId.toString();
    this.editCourseId = enrollment.courseId.toString();
    this.editModalOpen.set(true);
    this.editError.set('');
    this.editMessage.set('');
  }

  toggleEditModal(open?: boolean) {
    this.editModalOpen.set(open ?? !this.editModalOpen());
    if (!open) {
      this.editingEnrollment = null;
    }
  }

  updateEnrollment() {
    if (!this.editingEnrollment) return;

    if (!this.editUserId) {
      this.editError.set('User ID is required');
      return;
    }
    if (!this.editCourseId) {
      this.editError.set('Course ID is required');
      return;
    }

    this.isEditing.set(true);
    this.editError.set('');
    this.editMessage.set('');

    const enrollmentData = {
      userId: parseInt(this.editUserId),
      courseId: parseInt(this.editCourseId),
    };

    this.http.put<Result<any>>(`${this.baseUrl}/Enrollment/${this.editingEnrollment.id}`, enrollmentData, {
      headers: this.getHeaders(),
    }).subscribe({
      next: (response) => {
        if (response.success) {
          this.editMessage.set('Enrollment updated successfully!');
          setTimeout(() => {
            this.toggleEditModal(false);
            this.loadEnrollments();
          }, 1000);
        } else {
          this.editError.set(response.message || 'Failed to update enrollment');
        }
        this.isEditing.set(false);
      },
      error: (err) => {
        this.editError.set(err.error?.message || 'Error updating enrollment');
        this.isEditing.set(false);
      },
    });
  }

  confirmDelete(id: number) {
    this.deletingEnrollmentId = id;
    this.deleteModalOpen.set(true);
  }

  toggleDeleteModal(open?: boolean) {
    this.deleteModalOpen.set(open ?? !this.deleteModalOpen());
    if (!open) {
      this.deletingEnrollmentId = null;
    }
  }

  deleteEnrollment() {
    if (!this.deletingEnrollmentId) return;

    this.http.delete<Result<any>>(`${this.baseUrl}/Enrollment/${this.deletingEnrollmentId}`, {
      headers: this.getHeaders(),
    }).subscribe({
      next: (response) => {
        if (response.success) {
          this.toggleDeleteModal(false);
          this.loadEnrollments();
        } else {
          alert(response.message || 'Failed to delete enrollment');
        }
      },
      error: (err) => {
        alert(err.error?.message || 'Error deleting enrollment');
      },
    });
  }
}
