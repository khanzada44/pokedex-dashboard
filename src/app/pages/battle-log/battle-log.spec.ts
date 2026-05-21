import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BattleLog } from './battle-log';

describe('BattleLog', () => {
  let component: BattleLog;
  let fixture: ComponentFixture<BattleLog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BattleLog],
    }).compileComponents();

    fixture = TestBed.createComponent(BattleLog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
