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
  selector: 'app-assignments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './assignments.html',
  styleUrls: ['./assignments.css'],
})
export class Assignments implements OnInit {
  private readonly baseUrl = 'https://localhost:7108/api';

  assignments = signal<AssignmentResponse[]>([]);
  filteredAssignments = signal<AssignmentResponse[]>([]);
  isLoading = signal(false);
  error = signal('');
  notAuthorized = signal(false);
  enrolledCourseIds = signal<number[]>([]);
  isInstructor = signal(false);
  instructorCourseIds = signal<number[]>([]);

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

  // Search functionality
  searchById = '';
  searchByCourseId = '';
  searchResults = signal<AssignmentResponse[]>([]);
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

  private isStudent(): boolean {
    const currentUser = this.getCurrentUser();
    return currentUser ? currentUser.role === 0 : false;
  }

  private isCurrentUserInstructor(): boolean {
    const currentUser = this.getCurrentUser();
    return currentUser ? currentUser.role === 1 : false;
  }

  canEditAssignment(): boolean {
    const currentUser = this.getCurrentUser();
    return currentUser ? currentUser.role >= 1 : false; // Instructor (1) and Admin (2)
  }

  canDeleteAssignment(): boolean {
    const currentUser = this.getCurrentUser();
    return currentUser ? currentUser.role >= 1 : false; // Instructor (1) and Admin (2)
  }

  canAddAssignment(): boolean {
    const currentUser = this.getCurrentUser();
    return currentUser ? currentUser.role >= 1 : false; // Instructor (1) and Admin (2)
  }

  hasActions(): boolean {
    return this.canEditAssignment() || this.canDeleteAssignment();
  }

  // Search methods
  searchAssignmentById() {
    const idStr = String(this.searchById).trim();
    if (!idStr) {
      this.searchError.set('Please enter an assignment ID');
      return;
    }

    const id = parseInt(idStr, 10);
    if (isNaN(id) || id <= 0) {
      this.searchError.set('Assignment ID must be a positive number');
      return;
    }

    this.isSearching.set(true);
    this.searchError.set('');
    this.searchResults.set([]);
    this.http.get<Result<AssignmentResponse>>(`${this.baseUrl}/Assignment/${id}`, {
      headers: this.getHeaders(),
    }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.searchResults.set([response.data]);
          this.showSearchResults.set(true);
        } else {
          this.searchError.set(response.message || 'Assignment not found');
        }
        this.isSearching.set(false);
      },
      error: (err) => {
        this.searchError.set(err.error?.message || 'Error searching for assignment');
        this.isSearching.set(false);
      },
    });
  }

  searchAssignmentsByCourseId() {
    const courseIdStr = String(this.searchByCourseId).trim();
    if (!courseIdStr) {
      this.searchError.set('Please enter a course ID');
      return;
    }

    const courseId = parseInt(courseIdStr, 10);
    if (isNaN(courseId) || courseId <= 0) {
      this.searchError.set('Course ID must be a positive number');
      return;
    }

    this.isSearching.set(true);
    this.searchError.set('');
    this.searchResults.set([]);
    this.http.get<Result<AssignmentResponse[]>>(`${this.baseUrl}/Assignment/course/${courseId}`, {
      headers: this.getHeaders(),
    }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.searchResults.set(response.data);
          this.showSearchResults.set(true);
        } else {
          this.searchError.set(response.message || 'No assignments found for this course');
        }
        this.isSearching.set(false);
      },
      error: (err) => {
        this.searchError.set(err.error?.message || 'Error searching for assignments');
        this.isSearching.set(false);
      },
    });
  }

  clearSearchResults() {
    this.showSearchResults.set(false);
    this.searchResults.set([]);
    this.searchError.set('');
    this.searchById = '';
    this.searchByCourseId = '';
  }

  private loadInstructorCourses(instructorId: number) {
    this.http.get<Result<any[]>>(`${this.baseUrl}/Course`, {
      headers: this.getHeaders(),
    }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const courseIds = response.data
            .filter((c: any) => c.instructorId === instructorId)
            .map((c: any) => c.id);
          this.instructorCourseIds.set(courseIds);
          this.loadAssignments();
        } else {
          this.loadAssignments();
        }
      },
      error: () => {
        this.loadAssignments();
      },
    });
  }

  constructor(private http: HttpClient) {}

  ngOnInit() {
    const currentUser = this.getCurrentUser();
    const isInstructorUser = this.isCurrentUserInstructor();
    this.isInstructor.set(isInstructorUser);

    if (this.isStudent()) {
      this.loadStudentEnrollments();
    } else if (isInstructorUser) {
      this.loadInstructorCourses(currentUser!.id);
    } else {
      this.loadAssignments();
    }
  }

  private loadStudentEnrollments() {
    this.http.get<Result<EnrollmentResponse[]>>(`${this.baseUrl}/Enrollment/my`, {
      headers: this.getHeaders(),
    }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const courseIds = response.data.map(e => e.courseId);
          this.enrolledCourseIds.set(courseIds);
          this.loadAssignments();
        } else {
          this.enrolledCourseIds.set([]);
          this.loadAssignments();
        }
      },
      error: (err) => {
        console.error('Error loading enrollments:', err);
        this.enrolledCourseIds.set([]);
        this.loadAssignments();
      },
    });
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
          // Filter based on user role
          if (this.isStudent()) {
            const enrolledIds = this.enrolledCourseIds();
            const filtered = response.data.filter(a => enrolledIds.includes(a.courseId));
            this.filteredAssignments.set(filtered);
          } else if (this.isInstructor()) {
            const instructorIds = this.instructorCourseIds();
            const filtered = response.data.filter(a => instructorIds.includes(a.courseId));
            this.filteredAssignments.set(filtered);
          } else {
            this.filteredAssignments.set(response.data);
          }
        } else {
          this.error.set(response.message || 'Failed to load assignments');
          this.assignments.set([]);
          this.filteredAssignments.set([]);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        if (err.status === 403) {
          this.notAuthorized.set(true);
          this.error.set('');
        } else {
          this.error.set('Error loading assignments: ' + (err.error?.message || err.message));
        }
        this.assignments.set([]);
        this.filteredAssignments.set([]);
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

    // Validate course access for instructors
    if (this.isInstructor()) {
      const courseId = this.newCourseId ? parseInt(this.newCourseId) : 0;
      const instructorCourseIds = this.instructorCourseIds();
      if (!instructorCourseIds.includes(courseId)) {
        this.submitError.set('You can only add assignments to your own course');
        return;
      }
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

    // Validate course access for instructors
    if (this.isInstructor()) {
      const courseId = this.editCourseId ? parseInt(this.editCourseId) : 0;
      const instructorCourseIds = this.instructorCourseIds();
      if (!instructorCourseIds.includes(courseId)) {
        this.editError.set('You can only edit assignments for your own course');
        return;
      }
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
