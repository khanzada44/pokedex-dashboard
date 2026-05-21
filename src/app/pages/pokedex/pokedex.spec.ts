import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Pokedex } from './pokedex';

describe('Pokedex', () => {
  let component: Pokedex;
  let fixture: ComponentFixture<Pokedex>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Pokedex],
    }).compileComponents();

    fixture = TestBed.createComponent(Pokedex);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
