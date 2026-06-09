import { Injectable, inject, DestroyRef, signal, computed } from '@angular/core';
import { BehaviorSubject, throwError, interval } from 'rxjs';
import { tap, catchError, retry, switchMap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Trainer } from '../models/trainer.model';
import { Team } from '../models/team.model';
import { Battle, BattleLogEntry } from '../models/battle.model';
import { TrainerService } from '../services/trainer.service';
import { BattleGraphqlService } from '../services/battle.service';

// ─── State Shape ─────────────────────────────────────────────────────────────

export interface LocalTrainerState {
  currentTrainerId: number;
  trainers: Trainer[];
  teams: Team[];
  battles: Battle[];
  battleLogs: BattleLogEntry[];
  loading: boolean;
  error: string | null;
}

const initialState: LocalTrainerState = {
  currentTrainerId: 1,
  trainers: [],
  teams: [
    {
      id: 1,
      trainer_id: 1,
      name: 'Kanto Starters',
      pokemon_ids: [25, 6],
      created_at: new Date().toISOString()
    }
  ],
  battles: [],
  battleLogs: [],
  loading: false,
  error: null
};

// ─── Store ────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class TrainerDashboardStore {

  // ── DI ──────────────────────────────────────────────────────────────────────
  private trainerService = inject(TrainerService);
  private battleService  = inject(BattleGraphqlService);
  private destroyRef     = inject(DestroyRef);

  // ── Signals (used by components directly) ───────────────────────────────────
  /** Signal holding all saved teams (mirrors state$.teams for component use) */
  teams = signal<Team[]>([]);

  /** Signal holding the currently selected Pokémon for team-builder */
  selectedPokemon = signal<any[]>([]);

  /** Derived signal: all teams (alias for templates that prefer signal API) */
  allTeams = computed(() => this.teams());

  // ── BehaviorSubject Core ─────────────────────────────────────────────────────
  private state$ = new BehaviorSubject<LocalTrainerState>(initialState);

  /** Public observable stream consumed via toSignal() in components */
  public state = this.state$.asObservable();

  constructor() {
    this.initLiveBattleFeed();
  }

  // ── Snapshot Helper ──────────────────────────────────────────────────────────

  /**
   * Returns the current synchronous snapshot of the state.
   * Use only when you need the value outside an observable chain.
   */
  get snapshot(): LocalTrainerState {
    return this.state$.getValue();
  }

  // ── Private Methods ──────────────────────────────────────────────────────────

  /**
   * Initialises polling to simulate a live battle-log feed every 5 seconds.
   *
   * NOTE: True WebSocket subscriptions are not supported by json-graphql-server.
   * RxJS interval(5000) + switchMap is used instead to poll for new entries
   * and emit only the latest batch into the state.
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

  // ── Public Actions ────────────────────────────────────────────────────────────

  /**
   * Sets the active trainer ID.
   * All computed selectors in the component re-evaluate automatically.
   *
   * @param id - Trainer ID to activate
   */
  setTrainerId(id: number): void {
    this.state$.next({ ...this.snapshot, currentTrainerId: id });
  }

  /**
   * Fetches all trainers, teams, and battles from the local GraphQL server.
   * Retries up to 3 times with a 1-second delay on failure.
   */
  loadDashboardData(): void {
    this.state$.next({ ...this.snapshot, loading: true, error: null });

    this.trainerService.getTrainerDashboard().pipe(
      retry({ count: 3, delay: 1000 }),
      tap(response => {
        const data = response.data;
        const newTeams = data.allTeams?.length ? data.allTeams : this.snapshot.teams;

        this.state$.next({
          ...this.snapshot,
          trainers:   data.allTrainers  ?? [],
          teams:      newTeams,
          battles:    data.allBattles   ?? [],
          battleLogs: data.allBattleLogs ?? [],
          loading:    false
        });

        // Keep signal in sync
        this.teams.set(newTeams);
      }),
      catchError(err => {
        this.state$.next({
          ...this.snapshot,
          loading: false,
          error: 'Failed to load dashboard data. Is the local server running?'
        });
        return throwError(() => err);
      })
    ).subscribe();
  }

  /**
   * Saves a new team using an optimistic update pattern:
   * 1. Immediately inserts a local copy into state (instant UI feedback).
   * 2. Calls the mutation; rolls back and alerts on failure.
   *
   * @param teamName  - Display name for the team
   * @param pokemonIds - Array of Pokédex IDs (1–6 entries)
   */
  saveTrainerTeam(teamName: string, pokemonIds: number[]): void {
    const previousState = { ...this.snapshot, teams: [...this.snapshot.teams] };

    const optimisticTeam: Team = {
      id:          Math.floor(Math.random() * 100_000),
      trainer_id:  this.snapshot.currentTrainerId,
      name:        teamName,
      pokemon_ids: pokemonIds,
      created_at:  new Date().toISOString()
    };

    const updatedTeams = [...this.snapshot.teams, optimisticTeam];
    this.state$.next({ ...this.snapshot, teams: updatedTeams });
    this.teams.set(updatedTeams);

    this.trainerService.createNewTeam(optimisticTeam).pipe(
      catchError(error => {
        // Rollback on error
        this.state$.next(previousState);
        this.teams.set(previousState.teams);
        alert('Server error: team was not saved. Please try again.');
        return throwError(() => error);
      })
    ).subscribe();
  }

  /**
   * Deletes a team by ID with optimistic removal.
   * Rolls back if the server mutation fails.
   *
   * @param teamId - ID of the team to remove
   */
  deleteTeam(teamId: number): void {
    const previousState = { ...this.snapshot, teams: [...this.snapshot.teams] };

    const updatedTeams = this.snapshot.teams.filter(t => t.id !== teamId);
    this.state$.next({ ...this.snapshot, teams: updatedTeams });
    this.teams.set(updatedTeams);

    this.trainerService.deleteTeam(teamId.toString()).pipe(
      catchError(err => {
        this.state$.next(previousState);
        this.teams.set(previousState.teams);
        alert('Failed to delete team from server.');
        return throwError(() => err);
      })
    ).subscribe();
  }

  /**
   * Logs a new battle result via mutation.
   * Appends to local battles list optimistically.
   *
   * @param payload - Battle fields: opponent_name, team_id, result, scores, date, trainer_id
   */
  logBattle(payload: Omit<Battle, 'id'>): void {
    const previousState = { ...this.snapshot, battles: [...this.snapshot.battles] };

    const optimisticBattle: Battle = {
      id: Math.floor(Math.random() * 100_000),
      ...payload
    };

    this.state$.next({
      ...this.snapshot,
      battles: [...this.snapshot.battles, optimisticBattle]
    });

    this.trainerService.logBattle(payload).pipe(
      catchError(err => {
        this.state$.next(previousState);
        alert('Failed to log battle. Please try again.');
        return throwError(() => err);
      })
    ).subscribe();
  }

  /**
   * Updates a trainer's profile fields (name, region, badge_count).
   * Applies optimistic update; rolls back on server error.
   *
   * @param trainerId - ID of the trainer to update
   * @param changes   - Partial trainer fields to apply
   */
  updateTrainerProfile(trainerId: number, changes: Partial<Trainer>): void {
    const previousState = { ...this.snapshot, trainers: [...this.snapshot.trainers] };

    const updatedTrainers = this.snapshot.trainers.map(t =>
      t.id === trainerId ? { ...t, ...changes } : t
    );

    this.state$.next({ ...this.snapshot, trainers: updatedTrainers });

    this.trainerService.updateTrainerProfile(trainerId, changes).pipe(
      catchError(err => {
        this.state$.next(previousState);
        alert('Failed to update profile. Please try again.');
        return throwError(() => err);
      })
    ).subscribe();
  }

  /**
   * Adds Pokémon IDs to an existing team (max 6 total).
   * Optimistic update with server sync and rollback.
   *
   * @param teamId        - ID of the team to update
   * @param newPokemonIds - IDs to append
   */
  addPokemonToTeam(teamId: number, newPokemonIds: number[]): void {
    const previousState = { ...this.snapshot, teams: this.snapshot.teams.map(t => ({ ...t, pokemon_ids: [...t.pokemon_ids] })) };

    const updatedTeams = this.snapshot.teams.map(t => {
      if (t.id !== teamId) return t;
      if (t.pokemon_ids.length + newPokemonIds.length > 6) {
        alert('A team cannot have more than 6 Pokémon.');
        return t;
      }
      return { ...t, pokemon_ids: [...t.pokemon_ids, ...newPokemonIds] };
    });

    this.state$.next({ ...this.snapshot, teams: updatedTeams });
    this.teams.set(updatedTeams);

    const target = updatedTeams.find(t => t.id === teamId);
    if (!target) return;

    this.trainerService.updateTeam(teamId.toString(), target.pokemon_ids).pipe(
      catchError(err => {
        this.state$.next(previousState);
        this.teams.set(previousState.teams);
        alert('Failed to sync team with server.');
        return throwError(() => err);
      })
    ).subscribe();
  }
}