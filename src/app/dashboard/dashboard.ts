import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError, finalize, timeout, throwError } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class Dashboard implements OnInit {

  private readonly baseUrl = 'https://localhost:7108/api';
  private readonly loginUrl = `${this.baseUrl}/Auth/Login`;
  private readonly registerUrl = `${this.baseUrl}/Auth/Register`;
  private readonly enrollmentUrl = `${this.baseUrl}/Enrollment`;
  private readonly assignmentUrl = `${this.baseUrl}/Assignment`;

  totalStudents = signal(0);
  totalInstructors = signal(0);
  totalCourses = signal(0);
  totalEnrollments = signal(0);
  totalAssignments = signal(0);

  loginModalOpen = false;
  loginUsername = '';
  loginPassword = '';
  isLoggingIn = false;
  loginError = '';
  loginMessage = '';

  userModalOpen = false;
  newUsername = '';
  newEmail = '';
  newPassword = '';
  newRole = '0';
  isSubmitting = false;
  submitError = '';
  submitMessage = '';

  courseModalOpen = false;
  newCourseTitle = '';
  newCourseDescription = '';
  newCourseInstructorId = '';
  isCourseSubmitting = false;
  courseSubmitError = '';
  courseSubmitMessage = '';

  enrollmentModalOpen = false;
  newEnrollmentUserId = '';
  newEnrollmentCourseId = '';
  isEnrollmentSubmitting = false;
  enrollmentSubmitError = '';
  enrollmentSubmitMessage = '';

  assignmentModalOpen = false;
  newAssignmentTitle = '';
  newAssignmentDescription = '';
  newAssignmentDueDate = '';
  newAssignmentCourseId = '';
  isAssignmentSubmitting = false;
  assignmentSubmitError = '';
  assignmentSubmitMessage = '';

  private jwtToken = '';

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef, private route: ActivatedRoute) {}

  ngOnInit() {
    this.jwtToken = localStorage.getItem('jwtToken') || '';
    this.route.fragment.subscribe((fragment) => {
      if (fragment === 'login') {
        this.toggleLoginModal(true);
      }
    });
    this.loadStats();
  }

  loadStats() {
    const headers = this.getAuthHeaders();
    this.http.get<any>(`${this.baseUrl}/dashboard`, { headers })
      .subscribe({
        next: (res) => {
          console.log('DATA:', res);

          const payload = res?.data ?? res;

          this.totalStudents.set(payload.students ?? payload.totalStudents ?? 0);
          this.totalInstructors.set(payload.instructors ?? payload.totalInstructors ?? 0);
          this.totalCourses.set(payload.courses ?? payload.totalCourses ?? 0);
          this.totalEnrollments.set(payload.enrollments ?? payload.totalEnrollments ?? 0);
          this.totalAssignments.set(payload.assignments ?? payload.totalAssignments ?? 0);

          console.log('TOTALS:', {
            totalStudents: this.totalStudents(),
            totalInstructors: this.totalInstructors(),
            totalCourses: this.totalCourses(),
            totalEnrollments: this.totalEnrollments(),
            totalAssignments: this.totalAssignments(),
          });

          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('ERROR:', err);
        }
      });
  }

  toggleLoginModal(value: boolean) {
    this.loginModalOpen = value;
    if (!value) {
      this.loginUsername = '';
      this.loginPassword = '';
      this.loginError = '';
      this.loginMessage = '';
    }
  }

  submitLogin() {
    this.loginError = '';
    this.loginMessage = '';

    if (!this.loginUsername.trim() || !this.loginPassword.trim()) {
      this.loginError = 'Username and password are required.';
      return;
    }

    const loginData = {
      username: this.loginUsername.trim(),
      password: this.loginPassword,
    };

    this.isLoggingIn = true;
    this.http.post<any>(this.loginUrl, loginData).pipe(
      timeout(10000),
      catchError((err) => {
        console.error('LOGIN ERROR:', err);
        const message = err?.status === 0
          ? 'Unable to reach the server. Check if the backend is running.'
          : err?.error?.message || err?.message || 'Login failed.';
        this.loginError = message;
        return throwError(() => err);
      }),
      finalize(() => {
        this.isLoggingIn = false;
      })
    ).subscribe({
      next: (res) => {
        console.log('LOGIN RESPONSE:', res);
        if (res?.data?.token) {
          this.jwtToken = res.data.token;
          localStorage.setItem('jwtToken', this.jwtToken);
          this.loginMessage = 'Login successful.';
          this.toggleLoginModal(false);
          this.loadStats(); // Refresh stats with auth
        } else {
          this.loginError = 'Invalid login response.';
        }
      },
      error: () => {
        // error already handled
      }
    });
  }

  toggleUserModal(value: boolean) {
    this.userModalOpen = value;
    if (!value) {
      this.newUsername = '';
      this.newEmail = '';
      this.newPassword = '';
      this.newRole = '0';
      this.submitError = '';
      this.submitMessage = '';
    }
  }

  toggleCourseModal(value: boolean) {
    this.courseModalOpen = value;
    if (!value) {
      this.newCourseTitle = '';
      this.newCourseDescription = '';
      this.newCourseInstructorId = '';
      this.courseSubmitError = '';
      this.courseSubmitMessage = '';
    }
  }

  toggleEnrollmentModal(value: boolean) {
    this.enrollmentModalOpen = value;
    if (!value) {
      this.newEnrollmentUserId = '';
      this.newEnrollmentCourseId = '';
      this.enrollmentSubmitError = '';
      this.enrollmentSubmitMessage = '';
    }
  }

  toggleAssignmentModal(value: boolean) {
    this.assignmentModalOpen = value;
    if (!value) {
      this.newAssignmentTitle = '';
      this.newAssignmentDescription = '';
      this.newAssignmentDueDate = '';
      this.newAssignmentCourseId = '';
      this.assignmentSubmitError = '';
      this.assignmentSubmitMessage = '';
    }
  }

  submitNewUser() {
    this.submitError = '';
    this.submitMessage = '';

    if (!this.newUsername.trim() || !this.newEmail.trim() || !this.newPassword.trim()) {
      this.submitError = 'Username, email, and password are required.';
      return;
    }

    const user = {
      username: this.newUsername.trim(),
      password: this.newPassword,
      email: this.newEmail.trim(),
      role: Number(this.newRole),
    };

    this.isSubmitting = true;
    const headers = this.getAuthHeaders();
    this.http.post<any>(this.registerUrl, user, { headers }).pipe(
      timeout(10000),
      catchError((err) => {
        console.error('CREATE USER ERROR:', err);
        const message = err?.status === 0
          ? 'Unable to reach the server. Check if the backend is running.'
          : err?.error?.message || err?.message || 'Unable to create user.';
        this.submitError = message;
        return throwError(() => err);
      }),
      finalize(() => {
        this.isSubmitting = false;
      })
    ).subscribe({
      next: (res) => {
        console.log('USER CREATED:', res);
        this.submitMessage = 'User created successfully.';
        this.loadStats();
        this.toggleUserModal(false);
      },
      error: () => {
        // error already handled in catchError
      }
    });
  }

  submitNewCourse() {
    this.courseSubmitError = '';
    this.courseSubmitMessage = '';

    if (!this.newCourseTitle.trim() || !this.newCourseDescription.trim() || !this.newCourseInstructorId) {
      this.courseSubmitError = 'Title, description, and instructor ID are required.';
      return;
    }

    console.log('Course submit passing validation');
    console.log('JWT Token:', this.jwtToken);

    if (!this.jwtToken) {
      this.courseSubmitError = 'You must be logged in as admin to create courses.';
      this.cdr.detectChanges();
      return;
    }

    const course = {
      title: this.newCourseTitle.trim(),
      description: this.newCourseDescription.trim(),
      instuctorId: this.newCourseInstructorId,
    };

    this.isCourseSubmitting = true;
    const headers = this.getAuthHeaders();
    console.log('Submitting course with:', { course, headers: headers.get('Authorization') });
    
    this.http.post<any>(`${this.baseUrl}/Course`, course, { headers }).pipe(
      timeout(10000),
      catchError((err) => {
        console.error('CREATE COURSE ERROR:', err);
        const message = err?.status === 0
          ? 'Unable to reach the server. Check if the backend is running.'
          : err?.error?.message || err?.message || 'Unable to create course.';
        this.courseSubmitError = message;
        return throwError(() => err);
      }),
      finalize(() => {
        this.isCourseSubmitting = false;
      })
    ).subscribe({
      next: (res) => {
        console.log('COURSE CREATED:', res);
        this.courseSubmitMessage = 'Course created successfully.';
        this.loadStats();
        this.toggleCourseModal(false);
      },
      error: (err) => {
        this.courseSubmitError = err?.error?.message || 'Failed to create course. Check if logged in.';
      }
    });
  }

  submitNewEnrollment() {
    this.enrollmentSubmitError = '';
    this.enrollmentSubmitMessage = '';

    if (!this.newEnrollmentUserId || !this.newEnrollmentCourseId) {
      this.enrollmentSubmitError = 'User ID and course ID are required.';
      return;
    }

    if (!this.jwtToken) {
      this.enrollmentSubmitError = 'You must be logged in as admin to add enrollments.';
      this.cdr.detectChanges();
      return;
    }

    const enrollment = {
      userId: Number(this.newEnrollmentUserId),
      courseId: Number(this.newEnrollmentCourseId),
    };

    this.isEnrollmentSubmitting = true;
    const headers = this.getAuthHeaders();
    this.http.post<any>(`${this.baseUrl}/Enrollment`, enrollment, { headers }).pipe(
      timeout(10000),
      catchError((err) => {
        console.error('CREATE ENROLLMENT ERROR:', err);
        const message = err?.status === 0
          ? 'Unable to reach the server. Check if the backend is running.'
          : err?.error?.message || err?.message || 'Unable to create enrollment.';
        this.enrollmentSubmitError = message;
        return throwError(() => err);
      }),
      finalize(() => {
        this.isEnrollmentSubmitting = false;
      })
    ).subscribe({
      next: (res) => {
        console.log('ENROLLMENT CREATED:', res);
        this.enrollmentSubmitMessage = 'Enrollment created successfully.';
        this.loadStats();
        this.toggleEnrollmentModal(false);
      },
      error: (err) => {
        this.enrollmentSubmitError = err?.error?.message || 'Failed to create enrollment. Check if logged in.';
      }
    });
  }

  submitNewAssignment() {
    this.assignmentSubmitError = '';
    this.assignmentSubmitMessage = '';

    if (!this.newAssignmentTitle.trim() || !this.newAssignmentDescription.trim() || !this.newAssignmentCourseId) {
      this.assignmentSubmitError = 'Title, description, and course ID are required.';
      return;
    }

    if (!this.jwtToken) {
      this.assignmentSubmitError = 'You must be logged in as admin to create assignments.';
      this.cdr.detectChanges();
      return;
    }

    const assignment = {
      title: this.newAssignmentTitle.trim(),
      description: this.newAssignmentDescription.trim(),
      dueDate: this.newAssignmentDueDate ? new Date(this.newAssignmentDueDate).toISOString() : new Date().toISOString(),
      courseId: this.newAssignmentCourseId,
    };

    this.isAssignmentSubmitting = true;
    const headers = this.getAuthHeaders();
    console.log('Submitting assignment:', assignment);
    
    this.http.post<any>(this.assignmentUrl, assignment, { headers }).pipe(
      timeout(10000),
      catchError((err) => {
        console.error('CREATE ASSIGNMENT ERROR:', err);
        const message = err?.status === 0
          ? 'Unable to reach the server. Check if the backend is running.'
          : err?.error?.message || err?.message || 'Unable to create assignment.';
        this.assignmentSubmitError = message;
        return throwError(() => err);
      }),
      finalize(() => {
        this.isAssignmentSubmitting = false;
      })
    ).subscribe({
      next: (res) => {
        console.log('ASSIGNMENT CREATED:', res);
        this.assignmentSubmitMessage = 'Assignment created successfully.';
        this.loadStats();
        this.toggleAssignmentModal(false);
      },
      error: (err) => {
        this.assignmentSubmitError = err?.error?.message || 'Failed to create assignment. Check if logged in.';
      }
    });
  }

  private getAuthHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': `Bearer ${this.jwtToken}`,
      'Content-Type': 'application/json'
    });
  }
}