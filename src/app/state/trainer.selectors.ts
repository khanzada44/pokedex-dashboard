import { Injectable, inject } from '@angular/core';
import { map, distinctUntilChanged } from 'rxjs/operators';
import { TrainerDashboardStore } from './trainer.store';

@Injectable({
  providedIn: 'root',
})
export class TrainerSelectors {
  private store = inject(TrainerDashboardStore);

  // Derived pipelines selectors
  public readonly trainers$ = this.store.state.pipe(map(s => s.trainers), distinctUntilChanged());
  public readonly teams$ = this.store.state.pipe(map(s => s.teams), distinctUntilChanged());
  public readonly battles$ = this.store.state.pipe(map(s => s.battles), distinctUntilChanged());
  public readonly isLoading$ = this.store.state.pipe(map(s => s.loading), distinctUntilChanged());
  public readonly error$ = this.store.state.pipe(map(s => s.error), distinctUntilChanged());
}