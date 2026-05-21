import { Injectable, inject, DestroyRef } from '@angular/core';
import { BehaviorSubject, throwError, interval } from 'rxjs';
import { tap, catchError, retry, switchMap, map } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Trainer } from '../models/trainer.model';
import { Team } from '../models/team.model';
import { Battle, BattleLogEntry } from '../models/battle.model';
import { TrainerService } from '../services/trainer.service';
import { BattleGraphqlService } from '../services/battle.service';

export interface LocalTrainerState {
  currentTrainerId: number;
  trainers: Trainer[];
  teams: Team[];
  battles: Battle[];
  battleLogs: BattleLogEntry[]; // New field
  loading: boolean;
  error: string | null;
}

const initialState: LocalTrainerState = {
  currentTrainerId: 1,
  trainers: [],
  teams: [
    { id: 1, trainer_id: 1, name: "Kanto Starters", pokemon_ids: [25, 6], created_at: new Date().toISOString() }
  ],
  battles: [],
  battleLogs: [], // Initialized
  loading: false,
  error: null
};

@Injectable({
  providedIn: 'root'
})
export class TrainerDashboardStore {
  private trainerService = inject(TrainerService);
  private battleService = inject(BattleGraphqlService);
  private destroyRef = inject(DestroyRef);

  private state$ = new BehaviorSubject<LocalTrainerState>(initialState);
  public state = this.state$.asObservable();

  constructor() {
    this.initLiveBattleFeed();
  }

  get snapshot(): LocalTrainerState {
    return this.state$.getValue();
  }

  /**
   * Initializes polling to fetch live battle logs every 5 seconds.
   * Note: Polling is used because json-graphql-server does not support true WebSockets.
   */
  private initLiveBattleFeed(): void {
    interval(5000).pipe(
      switchMap(() => this.battleService.getBattleData()),
      retry(3),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(({ battleLogs }) => {
      this.state$.next({ ...this.snapshot, battleLogs });
    });
  }

  /**
   * Sets the active trainer ID for the dashboard view.
   * @param id - The ID of the trainer to set as active.
   */
  setTrainerId(id: number): void {
    this.state$.next({ ...this.snapshot, currentTrainerId: id });
  }

  /**
   * Fetches all trainer, team, and battle data from the GraphQL backend.
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
          teams: data.allTeams?.length ? data.allTeams : this.snapshot.teams,
          battles: data.allBattles || [],
          battleLogs: data.allBattleLogs || [],
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
   * Optimistically saves a new team and updates the UI state.
   * @param teamName - Name of the new team
   * @param pokemonIds - Array of Pokemon IDs
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
   * Adds Pokemon to an existing team with boundary constraints.
   * @param teamId - ID of the team to update
   * @param newPokemonIds - IDs to add
   */
  addPokemonToTeam(teamId: number, newPokemonIds: number[]): void {
    const currentState = this.snapshot;
    const previousStateBackup = { ...currentState };

    const teamsCopy = currentState.teams.map(t => ({ ...t, pokemon_ids: [...t.pokemon_ids] }));
    const targetTeam = teamsCopy.find(t => t.id === teamId);

    if (!targetTeam) return;

    if (targetTeam.pokemon_ids.length + newPokemonIds.length > 6) {
      alert(`Validation Boundary Error: Lineup cannot exceed 6 slots total.`);
      return;
    }

    targetTeam.pokemon_ids = [...targetTeam.pokemon_ids, ...newPokemonIds];
    this.state$.next({
      ...currentState,
      teams: teamsCopy
    });

    this.trainerService.updateTeam(teamId.toString(), targetTeam.pokemon_ids).pipe(
      catchError(err => {
        this.state$.next(previousStateBackup);
        alert('Failed to sync team update with server.');
        return throwError(() => err);
      })
    ).subscribe();
  }
}