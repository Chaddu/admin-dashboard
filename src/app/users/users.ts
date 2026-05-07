import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';

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

  users = signal<UserResponse[]>([]);
  isLoading = signal(false);
  error = signal('');

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

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.isLoading.set(true);
    this.error.set('');

    const currentUser = this.getCurrentUser();

    if (currentUser && currentUser.role === 0) {
      // For students, load only their own profile
      this.loadStudentProfile(currentUser.id);
    } else {
      // For admins/instructors, load all users
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

    this.http.post<Result<UserResponse>>(`${this.baseUrl}/User`, userData, {
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
