import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';

enum UserRole {
  Student = 0,
  Instructor = 1,
  Admin = 2
}

interface UserResponse {
  id: number;
  username: string;
  email: string;
  role: UserRole;
}

interface Result<T> {
  success: boolean;
  data?: T;
  message?: string;
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.html',
  styleUrls: ['./users.css'],
})
export class Users implements OnInit {
  private readonly baseUrl = 'https://localhost:7108/api';
  private readonly registerUrl = `${this.baseUrl}/Auth/Register`;

  users = signal<UserResponse[]>([]);
  isLoading = signal(false);
  error = signal('');
  isStudent = signal(false);
  isInstructor = signal(false);
  viewingOwnProfile = signal(false);
  currentUserProfile = signal<UserResponse | null>(null);

  // Search functionality
  searchUsername = '';
  searchResults = signal<UserResponse | null>(null);
  searchError = signal('');
  isSearching = signal(false);
  instructorCourses = signal<any[]>([]);
  studentAlreadyEnrolled = signal(false);
  addingEnrollment = signal(false);
  
  // Enrollment from search modal
  enrollmentFromSearchModalOpen = signal(false);
  enrollmentCourseId = 0;
  enrollmentStudentId = 0;
  enrollmentStudentUsername = '';

  // Add user modal
  addModalOpen = signal(false);
  newUsername = '';
  newEmail = '';
  newPassword = '';
  newRole = '0';
  isSubmitting = signal(false);
  submitError = signal('');
  submitMessage = signal('');

  // Edit user modal
  editModalOpen = signal(false);
  editingUser: UserResponse | null = null;
  editUsername = '';
  editEmail = '';
  editRole = '0';
  isEditing = signal(false);
  editError = signal('');
  editMessage = signal('');

  // Delete confirmation modal
  deleteModalOpen = signal(false);
  deletingUserId: number | null = null;

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('jwtToken') || '';
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
  }

  private getCurrentUser(): { id: number; role: number } | null {
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

  canManageUsers(): boolean {
    const currentUser = this.getCurrentUser();
    return currentUser ? currentUser.role > 0 : false; // Only instructors (1) and admins (2) can manage users
  }

  private isCurrentUserStudent(): boolean {
    const currentUser = this.getCurrentUser();
    return currentUser ? currentUser.role === 0 : false;
  }

  private isCurrentUserInstructor(): boolean {
    const currentUser = this.getCurrentUser();
    return currentUser ? currentUser.role === 1 : false;
  }

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.isLoading.set(true);
    this.error.set('');

    const currentUser = this.getCurrentUser();
    const isStudentUser = this.isCurrentUserStudent();
    const isInstructorUser = this.isCurrentUserInstructor();
    
    this.isStudent.set(isStudentUser);
    this.isInstructor.set(isInstructorUser);

    if (isStudentUser) {
      // For students, load only their own profile
      this.loadStudentProfile(currentUser!.id);
    } else if (isInstructorUser) {
      // For instructors, load their courses and don't call GetAllUsers
      this.loadInstructorCourses(currentUser!.id);
      this.users.set([]);
      this.isLoading.set(false);
    } else {
      // For admins, load all users
      this.loadAllUsers();
    }
  }

  private loadStudentProfile(userId: number) {
    this.http.get<Result<UserResponse>>(`${this.baseUrl}/User/my`, {
      headers: this.getHeaders(),
    }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.users.set([response.data]);
        } else {
          this.users.set([]);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set('Error loading user: ' + (err.error?.message || err.message));
        this.isLoading.set(false);
      },
    });
  }

  private loadAllUsers() {
    this.http.get<Result<UserResponse[]>>(`${this.baseUrl}/User/GetAllUsers`, {
      headers: this.getHeaders(),
    }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.users.set(response.data);
        } else {
          this.error.set(response.message || 'Failed to load users');
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set('Error loading users: ' + (err.error?.message || err.message));
        this.isLoading.set(false);
      },
    });
  }

  getRoleName(role: number): string {
    return UserRole[role] || 'Unknown';
  }

  toggleAddModal(open?: boolean) {
    if (!this.canManageUsers()) return;
    this.addModalOpen.set(open ?? !this.addModalOpen());
    this.submitError.set('');
    this.submitMessage.set('');
    this.newUsername = '';
    this.newEmail = '';
    this.newPassword = '';
    this.newRole = '0';
  }

  submitUser() {
    if (!this.canManageUsers()) {
      this.submitError.set('You do not have permission to create users');
      return;
    }

    if (!this.newUsername.trim()) {
      this.submitError.set('Username is required');
      return;
    }
    if (!this.newEmail.trim()) {
      this.submitError.set('Email is required');
      return;
    }
    if (!this.newPassword.trim()) {
      this.submitError.set('Password is required');
      return;
    }

    this.isSubmitting.set(true);
    this.submitError.set('');
    this.submitMessage.set('');

    const userData = {
      username: this.newUsername,
      email: this.newEmail,
      password: this.newPassword,
      role: parseInt(this.newRole),
    };

    this.http.post<Result<UserResponse>>(this.registerUrl, userData, {
      headers: this.getHeaders(),
    }).subscribe({
      next: (response) => {
        if (response.success) {
          this.submitMessage.set('User created successfully!');
          setTimeout(() => {
            this.toggleAddModal(false);
            this.loadUsers();
          }, 1000);
        } else {
          this.submitError.set(response.message || 'Failed to create user');
        }
        this.isSubmitting.set(false);
      },
      error: (err) => {
        this.submitError.set(err.error?.message || 'Error creating user');
        this.isSubmitting.set(false);
      },
    });
  }

  openEditModal(user: UserResponse) {
    if (!this.canManageUsers()) return;
    this.editingUser = user;
    this.editUsername = user.username;
    this.editEmail = user.email;
    this.editRole = user.role.toString();
    this.editModalOpen.set(true);
    this.editError.set('');
    this.editMessage.set('');
  }

  openProfileEditModal(user: UserResponse) {
    // For students editing their own profile
    this.editingUser = user;
    this.editUsername = user.username;
    this.editEmail = user.email;
    this.editRole = user.role.toString();
    this.editModalOpen.set(true);
    this.editError.set('');
    this.editMessage.set('');
  }

  navigateToCourses() {
    this.router.navigate(['/courses']);
  }

  navigateToEnrollments() {
    this.router.navigate(['/enrollments']);
  }

  navigateToAssignments() {
    this.router.navigate(['/assignments']);
  }

  private loadInstructorCourses(instructorId: number) {
    this.http.get<Result<any[]>>(`${this.baseUrl}/Course`, {
      headers: this.getHeaders(),
    }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const instructorCourses = response.data.filter((c: any) => c.instructorId === instructorId);
          this.instructorCourses.set(instructorCourses);
        }
      },
      error: () => {
        this.instructorCourses.set([]);
      },
    });
  }

  searchStudent() {
    this.searchError.set('');
    this.searchResults.set(null);
    this.studentAlreadyEnrolled.set(false);

    if (!this.searchUsername.trim()) {
      this.searchError.set('Please enter a username');
      return;
    }

    this.isSearching.set(true);

    this.http.get<Result<UserResponse>>(`${this.baseUrl}/User/By-username?username=${this.searchUsername}`, {
      headers: this.getHeaders(),
    }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const foundUser = response.data;
          
          // Check if user is a student
          if (foundUser.role !== 0) {
            this.searchError.set('This user is not a student');
            this.isSearching.set(false);
            return;
          }

          // Check if student is already enrolled in instructor's course
          const instructorCourse = this.instructorCourses()[0];
          if (instructorCourse) {
            this.checkEnrollment(foundUser.id, instructorCourse.id, foundUser);
          } else {
            this.searchResults.set(foundUser);
            this.isSearching.set(false);
          }
        } else {
          this.searchError.set('User not found');
          this.isSearching.set(false);
        }
      },
      error: (err) => {
        this.searchError.set(err.error?.message || 'Error searching for user');
        this.isSearching.set(false);
      },
    });
  }

  private checkEnrollment(userId: number, courseId: number, user: UserResponse) {
    this.http.get<Result<any[]>>(`${this.baseUrl}/Enrollment`, {
      headers: this.getHeaders(),
    }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const isEnrolled = response.data.some((e: any) => e.userId === userId && e.courseId === courseId);
          this.studentAlreadyEnrolled.set(isEnrolled);
          this.searchResults.set(user);
        } else {
          this.searchResults.set(user);
        }
        this.isSearching.set(false);
      },
      error: () => {
        this.searchResults.set(user);
        this.isSearching.set(false);
      },
    });
  }

  openEnrollmentFromSearchModal() {
    const foundUser = this.searchResults();
    const instructorCourse = this.instructorCourses()[0];

    if (!foundUser || !instructorCourse) {
      this.searchError.set('Error: User or course not found');
      return;
    }

    this.enrollmentCourseId = instructorCourse.id;
    this.enrollmentStudentId = foundUser.id;
    this.enrollmentStudentUsername = foundUser.username;
    this.enrollmentFromSearchModalOpen.set(true);
  }

  closeEnrollmentFromSearchModal() {
    this.enrollmentFromSearchModalOpen.set(false);
    this.enrollmentCourseId = 0;
    this.enrollmentStudentId = 0;
    this.enrollmentStudentUsername = '';
  }

  confirmAddEnrollmentFromSearch() {
    this.addingEnrollment.set(true);

    const enrollmentData = {
      userId: this.enrollmentStudentId,
      courseId: this.enrollmentCourseId,
    };

    this.http.post<Result<any>>(`${this.baseUrl}/Enrollment`, enrollmentData, {
      headers: this.getHeaders(),
    }).subscribe({
      next: (response) => {
        if (response.success) {
          this.searchError.set('');
          this.searchUsername = '';
          this.searchResults.set(null);
          this.studentAlreadyEnrolled.set(false);
          this.closeEnrollmentFromSearchModal();
          alert('Enrollment added successfully!');
        } else {
          alert(response.message || 'Failed to add enrollment');
        }
        this.addingEnrollment.set(false);
      },
      error: (err) => {
        alert(err.error?.message || 'Error adding enrollment');
        this.addingEnrollment.set(false);
      },
    });
  }

  clearSearch() {
    this.searchUsername = '';
    this.searchResults.set(null);
    this.searchError.set('');
    this.studentAlreadyEnrolled.set(false);
  }

  openInstructorProfile() {
    const currentUser = this.getCurrentUser();
    if (!currentUser) return;

    // Load courses for this instructor
    this.loadInstructorCourses(currentUser.id);

    this.http.get<Result<UserResponse>>(`${this.baseUrl}/User/my`, {
      headers: this.getHeaders(),
    }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.currentUserProfile.set(response.data);
          this.viewingOwnProfile.set(true);
        } else {
          this.error.set('Failed to load profile');
        }
      },
      error: (err) => {
        this.error.set('Error loading profile: ' + (err.error?.message || err.message));
      },
    });
  }

  closeProfileView() {
    this.viewingOwnProfile.set(false);
    this.currentUserProfile.set(null);
  }

  toggleEditModal(open?: boolean) {
    this.editModalOpen.set(open ?? !this.editModalOpen());
    if (!open) {
      this.editingUser = null;
    }
  }

  updateUser() {
    if (!this.editingUser) return;

    if (!this.editUsername.trim()) {
      this.editError.set('Username is required');
      return;
    }
    if (!this.editEmail.trim()) {
      this.editError.set('Email is required');
      return;
    }

    this.isEditing.set(true);
    this.editError.set('');
    this.editMessage.set('');

    const userData = {
      username: this.editUsername,
      email: this.editEmail,
      role: parseInt(this.editRole),
    };

    this.http.put<Result<any>>(`${this.baseUrl}/User/${this.editingUser.id}`, userData, {
      headers: this.getHeaders(),
    }).subscribe({
      next: (response) => {
        if (response.success) {
          this.editMessage.set('User updated successfully!');
          setTimeout(() => {
            this.toggleEditModal(false);
            this.loadUsers();
          }, 1000);
        } else {
          this.editError.set(response.message || 'Failed to update user');
        }
        this.isEditing.set(false);
      },
      error: (err) => {
        this.editError.set(err.error?.message || 'Error updating user');
        this.isEditing.set(false);
      },
    });
  }

  confirmDelete(id: number) {
    if (!this.canManageUsers()) return;
    this.deletingUserId = id;
    this.deleteModalOpen.set(true);
  }

  toggleDeleteModal(open?: boolean) {
    this.deleteModalOpen.set(open ?? !this.deleteModalOpen());
    if (!open) {
      this.deletingUserId = null;
    }
  }

  deleteUser() {
    if (!this.deletingUserId) return;

    this.http.delete<Result<any>>(`${this.baseUrl}/User/${this.deletingUserId}`, {
      headers: this.getHeaders(),
    }).subscribe({
      next: (response) => {
        if (response.success) {
          this.toggleDeleteModal(false);
          this.loadUsers();
        } else {
          alert(response.message || 'Failed to delete user');
        }
      },
      error: (err) => {
        alert(err.error?.message || 'Error deleting user');
      },
    });
  }
}
