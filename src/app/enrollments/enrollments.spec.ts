import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Enrollments } from './enrollments';

describe('Enrollments', () => {
  let component: Enrollments;
  let fixture: ComponentFixture<Enrollments>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Enrollments],
    }).compileComponents();

    fixture = TestBed.createComponent(Enrollments);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
