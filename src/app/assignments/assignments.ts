import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';

interface AssignmentResponse {
  id: number;
  title: string;
  description: string;
  dueTime: string;
  courseId: number;
}

interface Result<T> {
  success: boolean;
  data?: T;
  message?: string;
}

@Component({
  selector: 'app-assignments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './assignments.html',
  styleUrls: ['./assignments.css'],
})
export class Assignments implements OnInit {
  private readonly baseUrl = 'https://localhost:7108/api';

  assignments = signal<AssignmentResponse[]>([]);
  isLoading = signal(false);
  error = signal('');

  // Add assignment modal
  addModalOpen = signal(false);
  newTitle = '';
  newDescription = '';
  newDueTime = '';
  newCourseId = '';
  isSubmitting = signal(false);
  submitError = signal('');
  submitMessage = signal('');

  // Edit assignment modal
  editModalOpen = signal(false);
  editingAssignment: AssignmentResponse | null = null;
  editTitle = '';
  editDescription = '';
  editDueTime = '';
  editCourseId = '';
  isEditing = signal(false);
  editError = signal('');
  editMessage = signal('');

  // Delete confirmation modal
  deleteModalOpen = signal(false);
  deletingAssignmentId: number | null = null;

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('jwtToken') || '';
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
  }

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadAssignments();
  }

  loadAssignments() {
    this.isLoading.set(true);
    this.error.set('');

    this.http.get<Result<AssignmentResponse[]>>(`${this.baseUrl}/Assignment`, {
      headers: this.getHeaders(),
    }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.assignments.set(response.data);
        } else {
          this.error.set(response.message || 'Failed to load assignments');
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set('Error loading assignments: ' + (err.error?.message || err.message));
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
    this.newTitle = '';
    this.newDescription = '';
    this.newDueTime = '';
    this.newCourseId = '';
  }

  submitAssignment() {
    if (!this.newTitle.trim()) {
      this.submitError.set('Title is required');
      return;
    }

    this.isSubmitting.set(true);
    this.submitError.set('');
    this.submitMessage.set('');

    const assignmentData = {
      title: this.newTitle,
      description: this.newDescription,
      dueTime: this.newDueTime ? new Date(this.newDueTime).toISOString() : new Date().toISOString(),
      courseId: this.newCourseId ? parseInt(this.newCourseId) : 0,
    };

    this.http.post<Result<AssignmentResponse>>(`${this.baseUrl}/Assignment`, assignmentData, {
      headers: this.getHeaders(),
    }).subscribe({
      next: (response) => {
        if (response.success) {
          this.submitMessage.set('Assignment created successfully!');
          setTimeout(() => {
            this.toggleAddModal(false);
            this.loadAssignments();
          }, 1000);
        } else {
          this.submitError.set(response.message || 'Failed to create assignment');
        }
        this.isSubmitting.set(false);
      },
      error: (err) => {
        this.submitError.set(err.error?.message || 'Error creating assignment');
        this.isSubmitting.set(false);
      },
    });
  }

  openEditModal(assignment: AssignmentResponse) {
    this.editingAssignment = assignment;
    this.editTitle = assignment.title;
    this.editDescription = assignment.description;
    this.editDueTime = assignment.dueTime ? assignment.dueTime.slice(0, 16) : '';
    this.editCourseId = assignment.courseId.toString();
    this.editModalOpen.set(true);
    this.editError.set('');
    this.editMessage.set('');
  }

  toggleEditModal(open?: boolean) {
    this.editModalOpen.set(open ?? !this.editModalOpen());
    if (!open) {
      this.editingAssignment = null;
    }
  }

  updateAssignment() {
    if (!this.editingAssignment) return;

    if (!this.editTitle.trim()) {
      this.editError.set('Title is required');
      return;
    }

    this.isEditing.set(true);
    this.editError.set('');
    this.editMessage.set('');

    const assignmentData = {
      title: this.editTitle,
      description: this.editDescription,
      dueTime: this.editDueTime ? new Date(this.editDueTime).toISOString() : new Date().toISOString(),
      courseId: this.editCourseId ? parseInt(this.editCourseId) : 0,
    };

    this.http.put<Result<any>>(`${this.baseUrl}/Assignment/${this.editingAssignment.id}`, assignmentData, {
      headers: this.getHeaders(),
    }).subscribe({
      next: (response) => {
        if (response.success) {
          this.editMessage.set('Assignment updated successfully!');
          setTimeout(() => {
            this.toggleEditModal(false);
            this.loadAssignments();
          }, 1000);
        } else {
          this.editError.set(response.message || 'Failed to update assignment');
        }
        this.isEditing.set(false);
      },
      error: (err) => {
        this.editError.set(err.error?.message || 'Error updating assignment');
        this.isEditing.set(false);
      },
    });
  }

  confirmDelete(id: number) {
    this.deletingAssignmentId = id;
    this.deleteModalOpen.set(true);
  }

  toggleDeleteModal(open?: boolean) {
    this.deleteModalOpen.set(open ?? !this.deleteModalOpen());
    if (!open) {
      this.deletingAssignmentId = null;
    }
  }

  deleteAssignment() {
    if (!this.deletingAssignmentId) return;

    this.http.delete<Result<any>>(`${this.baseUrl}/Assignment/${this.deletingAssignmentId}`, {
      headers: this.getHeaders(),
    }).subscribe({
      next: (response) => {
        if (response.success) {
          this.toggleDeleteModal(false);
          this.loadAssignments();
        } else {
          alert(response.message || 'Failed to delete assignment');
        }
      },
      error: (err) => {
        alert(err.error?.message || 'Error deleting assignment');
      },
    });
  }
}
