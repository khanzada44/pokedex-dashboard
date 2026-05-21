import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, throwError } from 'rxjs';
import { tap, catchError, retry } from 'rxjs/operators';
import { Trainer } from '../models/trainer.model';
import { Team } from '../models/team.model';
import { Battle } from '../models/battle.model';
import { TrainerService } from '../services/trainer.service';

export interface LocalTrainerState {
  currentTrainerId: number;
  trainers: Trainer[];
  teams: Team[];
  battles: Battle[];
  loading: boolean;
  error: string | null;
}

const initialState: LocalTrainerState = {
  currentTrainerId: 1, // Default Initial Active ID (e.g., Ash Ketchum)
  trainers: [],
  teams: [
    // Initial mock layer taake Pokedex checkbox check karte waqt validation error na aaye
    { id: 1, trainer_id: 1, name: "Kanto Starters", pokemon_ids: [25, 6], created_at: new Date().toISOString() }
  ],
  battles: [],
  loading: false,
  error: null
};

@Injectable({
  providedIn: 'root'
})
export class TrainerDashboardStore {
  private trainerService = inject(TrainerService);

  private state$ = new BehaviorSubject<LocalTrainerState>(initialState);
  public state = this.state$.asObservable();

  get snapshot(): LocalTrainerState {
    return this.state$.getValue();
  }

  /**
   * Active Trainer ID ko switch karne ke liye handler
   */
  setTrainerId(id: number): void {
    // FIX: Extra dots ko hata kar standard spread operator (...) kar diya hai
    this.state$.next({ ...this.snapshot, currentTrainerId: id });
  }

  /**
   * Complete remote data load karna dashboard ke liye
   */
  loadDashboardData(): void {
    this.state$.next({ ...this.snapshot, loading: true, error: null });

    this.trainerService.getTrainerDashboard().pipe(
      retry({ count: 3, delay: 1000 }),
      tap(response => {
        const data = response.data;
        this.state$.next({
          ...this.snapshot,
          trainers: data.allTrainers || [],
          // Agar server par teams khali hain toh local initial team ko priority do
          teams: data.allTeams && data.allTeams.length > 0 ? data.allTeams : this.snapshot.teams,
          battles: data.allBattles || [],
          loading: false
        });
      }),
      catchError(err => {
        this.state$.next({ ...this.snapshot, loading: false, error: 'Failed to fetch dashboard records.' });
        return throwError(() => err);
      })
    ).subscribe();
  }

  /**
   * Reactive Form se Nayi Team Save karne ka handler (Optimistic Update)
   */
  saveTrainerTeam(teamName: string, pokemonIds: number[]): void {
    const oldState = { ...this.snapshot };
    const simulatedId = Math.floor(Math.random() * 10000);

    const newTeam: Team = {
      id: simulatedId,
      trainer_id: this.snapshot.currentTrainerId,
      name: teamName,
      pokemon_ids: pokemonIds,
      created_at: new Date().toISOString()
    };

    this.state$.next({
      ...this.snapshot,
      teams: [...this.snapshot.teams, newTeam]
    });

    this.trainerService.createNewTeam(newTeam).pipe(
      catchError(error => {
        this.state$.next(oldState);
        alert('Server Issue! Team database me save nahi ho saki.');
        return throwError(() => error);
      })
    ).subscribe();
  }

  /**
   * POKEDEX DASHBOARD SE BIND: Checkboxes se aane wale Pokemon IDs ko insert karna
   */
  addPokemonToTeam(teamId: number, newPokemonIds: number[]): void {
    const currentState = this.snapshot;
    const previousStateBackup = { ...currentState };

    // Strict deep copy mechanics to avoid structural mutations
    const teamsCopy = currentState.teams.map(t => ({ ...t, pokemon_ids: [...t.pokemon_ids] }));
    const targetTeam = teamsCopy.find(t => t.id === teamId);

    if (!targetTeam) return;

    // Boundary constraint validation checker (Max 6 slots check)
    const totalProjectedCount = targetTeam.pokemon_ids.length + newPokemonIds.length;
    if (totalProjectedCount > 6) {
      alert(`Validation Boundary Error: Lineup cannot exceed 6 slots total.`);
      return;
    }

    // Optimistic push for instant feedback layout
    targetTeam.pokemon_ids = [...targetTeam.pokemon_ids, ...newPokemonIds];
    this.state$.next({
      ...currentState,
      teams: teamsCopy
    });

    // Server updates sync
    this.trainerService.updateTeam(teamId.toString(), targetTeam.pokemon_ids).pipe(
      catchError(err => {
        // Fallback restoration dynamic network trigger
        this.state$.next(previousStateBackup);
        alert('Failed to sync team update with server.');
        return throwError(() => err);
      })
    ).subscribe();
  }
}