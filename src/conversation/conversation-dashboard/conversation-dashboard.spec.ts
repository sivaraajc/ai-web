import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConversationDashboard } from './conversation-dashboard';

describe('ConversationDashboard', () => {
  let component: ConversationDashboard;
  let fixture: ComponentFixture<ConversationDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConversationDashboard],
    }).compileComponents();

    fixture = TestBed.createComponent(ConversationDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
