import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InvitationComponent } from './invitation.component';

describe('Invitation', () => {
  let component: InvitationComponent;
  let fixture: ComponentFixture<InvitationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InvitationComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(InvitationComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
