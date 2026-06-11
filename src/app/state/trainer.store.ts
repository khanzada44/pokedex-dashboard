import { Injectable, inject, DestroyRef, signal, computed, PLATFORM_ID, Inject } from '@angular/core';
import { BehaviorSubject, throwError, interval, of, combineLatest, Observable } from 'rxjs';
import { tap, catchError, retry, delay, switchMap, map, distinctUntilChanged, shareReplay } from 'rxjs/operators';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
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
  battleLogs: BattleLogEntry[];
  loading: boolean;
  error: string | null;
}

const initialState: LocalTrainerState = {
  currentTrainerId: 1,
  trainers: [],
  teams: [],
  battles: [],
  battleLogs: [],
  loading: false,
  error: null
};

@Injectable({ providedIn: 'root' })
export class TrainerDashboardStore {
  private trainerService = inject(TrainerService);
  private battleService  = inject(BattleGraphqlService);
  private destroyRef     = inject(DestroyRef);

  @Inject(PLATFORM_ID) private platformId: any;

  // private isBrowser: boolean;
  // private isServer: boolean;

  teams = signal<Team[]>([]);  
  selectedPokemon = signal<any[]>([]);
  isLoading = signal(false);
  currentTrainer = signal<Trainer | null>(null);
  error = signal<string | null>(null);
  allTeams = computed(() => this.teams());

  totalBattles = computed(() => this.state$.getValue().battles.length);
  winCount = computed(() => this.state$.getValue().battles.filter(b => b.result === 'win').length);
  lossCount = computed(() => this.state$.getValue().battles.filter(b => b.result === 'loss').length);

  winRate = computed(() => {
    const total = this.totalBattles();
    if (total === 0) return 0;
    return (this.winCount() / total) * 100;
  });
  
  /** Computed: Team type coverage analysis */
  teamTypeCoverage = computed(() => {
    const currentTeams = this.teams();
    return currentTeams.map(team => ({
      teamId: team.id,
      teamName: team.name,
      pokemonCount: team.pokemon_ids.length,
      coverageScore: (team.pokemon_ids.length / 6) * 100
    }));
  });
  
  private state$ = new BehaviorSubject<LocalTrainerState>(initialState);
  public state = this.state$.asObservable();
  public battles$ = this.state$.pipe(
    map(s => s.battles),
    distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
    shareReplay(1)
  );
  
  /** Selector: All battle logs */
  public battleLogs$ = this.state$.pipe(
    map(s => s.battleLogs),
    distinctUntilChanged(),
    shareReplay(1)
  );
  
  /** Selector: All teams */
  public teams$ = this.state$.pipe(
    map(s => s.teams),
    distinctUntilChanged(),
    shareReplay(1)
  );
  
  /** Selector: Loading state */
  public loading$ = this.state$.pipe(
    map(s => s.loading),
    distinctUntilChanged()
  );
  
  /** Selector: Error state */
  public error$ = this.state$.pipe(
    map(s => s.error),
    distinctUntilChanged()
  );
  
  /** Combined selector for dashboard overview */
  public dashboardOverview$ = combineLatest({
    battles: this.battles$,
    battleLogs: this.battleLogs$,
    teams: this.teams$,
    loading: this.loading$,
    totalBattles: toObservable(this.totalBattles),
    winRate: toObservable(this.winRate)
  }).pipe(shareReplay(1));

  constructor() {
    // Check platform for SSR compatibility
    // this.isBrowser = isPlatformBrowser(this.platformId);
    // this.isServer = isPlatformServer(this.platformId);
    
    // console.log('TrainerDashboardStore initialized - isBrowser:', this.isBrowser);
    
    this.initLiveBattleFeed();
    this.initTrainerPersistence();
  }
  
  /** Get current state snapshot */
  get snapshot(): LocalTrainerState {
    return this.state$.getValue();
  }


  private initLiveBattleFeed(): void {
    // Only run polling in browser, not in SSR
    // if (!this.isBrowser) {
    //   console.log('Skipping live battle feed on server');
    //   return;
    // }
    
    interval(5000).pipe(
      switchMap(() => this.battleService.getBattleLogs()),
      map(logs => {
        const currentLogs = this.snapshot.battleLogs;
        const currentIds = new Set(currentLogs.map(l => l.id));
        return logs.filter(log => !currentIds.has(log.id));
      }),
      retry({ count: 3, delay: 1000 }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(newLogs => {
      if (newLogs.length > 0) {
        const current = this.snapshot;
        this.state$.next({ 
          ...current, 
          battleLogs: [...current.battleLogs, ...newLogs] 
        });
      }
    });
  }


  private initTrainerPersistence(): void {
    // Only run in browser environment
    // if (!this.isBrowser) {
    //   console.log('Skipping localStorage on server');
    //   return;
    // }
    
    try {
      // Load from localStorage on init (only in browser)
      const savedTrainerId = localStorage.getItem('selectedTrainerId');
      if (savedTrainerId && !isNaN(parseInt(savedTrainerId))) {
        this.setTrainerId(parseInt(savedTrainerId));
      }
      
      // Save to localStorage whenever currentTrainerId changes
      this.state$.pipe(
        map(s => s.currentTrainerId),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      ).subscribe(trainerId => {
        try {
          localStorage.setItem('selectedTrainerId', trainerId.toString());
          console.log('Saved trainer ID to localStorage:', trainerId);
        } catch (e) {
          console.warn('Failed to save to localStorage:', e);
        }
      });
    } catch (error) {
      console.warn('localStorage is not available:', error);
      // Continue without persistence - app will still work
    }
  }

  setTrainerId(id: number): void {
    this.state$.next({ ...this.snapshot, currentTrainerId: id });
    this.loadDashboardData(); // Reload data for new trainer
  }


  loadDashboardData(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.state$.next({ ...this.snapshot, loading: true, error: null });

    this.trainerService.getTrainerDashboard().pipe(
      retry({ count: 3, delay: 1000 }),
      tap(response => {
        const data = response.data;
        
        // Preserve existing teams if API returns empty
        const newTeams = data.allTeams?.length ? data.allTeams : this.snapshot.teams;
        
        // Update trainers list
        const trainers = data.allTrainers ?? [];
        const currentTrainer = trainers.find((t: { id: number; }) => t.id === this.snapshot.currentTrainerId) || null;

        this.state$.next({
          ...this.snapshot,
          trainers: trainers,
          teams: newTeams,
          battles: data.allBattles ?? [],
          battleLogs: data.allBattleLogs ?? [],
          loading: false,
          error: null
        });

        // Update signals to keep in sync
        this.teams.set(newTeams);
        this.currentTrainer.set(currentTrainer);
        this.isLoading.set(false);
      }),
      catchError(err => {
        const errorMsg = 'Failed to load dashboard data. Is the local server running on port 4000?';
        this.state$.next({
          ...this.snapshot,
          loading: false,
          error: errorMsg
        });
        this.isLoading.set(false);
        this.error.set(errorMsg);
        return throwError(() => new Error(err));
      })
    ).subscribe();
  }


  saveTrainerTeam(teamName: string, pokemonIds: number[]): void {
    // Validation
    if (teamName.length < 3 || teamName.length > 30) {
      this.error.set('Team name must be between 3 and 30 characters');
      return;
    }
    if (pokemonIds.length < 1 || pokemonIds.length > 6) {
      this.error.set('Team must have between 1 and 6 Pokémon');
      return;
    }

    const previousState = { ...this.snapshot, teams: [...this.snapshot.teams] };

    // Optimistic update
    const optimisticTeam: Team = {
      id: Math.floor(Math.random() * 100_000),
      trainer_id: this.snapshot.currentTrainerId,
      name: teamName,
      pokemon_ids: pokemonIds,
      created_at: new Date().toISOString()
    };

    const updatedTeams = [...this.snapshot.teams, optimisticTeam];
    this.state$.next({ ...this.snapshot, teams: updatedTeams });
    this.teams.set(updatedTeams);

    // Actual API call
    this.trainerService.createNewTeam(optimisticTeam).pipe(
      catchError(error => {
        // Rollback on error
        this.state$.next(previousState);
        this.teams.set(previousState.teams);
        this.error.set('Server error: team was not saved. Please try again.');
        return throwError(() => error);
      })
    ).subscribe();
  }

  deleteTeam(teamId: number): void {
    const previousState = { ...this.snapshot, teams: [...this.snapshot.teams] };
    const teamToDelete = this.snapshot.teams.find(t => t.id === teamId);
    if (!teamToDelete) return;
    const updatedTeams = this.snapshot.teams.filter(t => t.id !== teamId);
    this.state$.next({ ...this.snapshot, teams: updatedTeams });
    this.teams.set(updatedTeams);
    this.trainerService.deleteTeam(teamId.toString()).pipe(
      catchError(err => {
        // Rollback on error
        this.state$.next(previousState);
        this.teams.set(previousState.teams);
        this.error.set('Failed to delete team from server.');
        return throwError(() => err);
      })
    ).subscribe();
  }

  logBattle(payload: Omit<Battle, 'id'>): Observable<Battle> {
    const previousState = { 
      ...this.snapshot, 
      battles: [...this.snapshot.battles] 
    };

    const optimisticBattle: Battle = {
      id: Math.floor(Math.random() * 100_000),
      ...payload
    };

    // Optimistic update
    this.state$.next({
      ...this.snapshot,
      battles: [...this.snapshot.battles, optimisticBattle]
    });

    // Actual API call
    return this.trainerService.logBattle(payload).pipe(
      tap(realBattle => {
        // Replace optimistic with real data
        const updatedBattles = this.snapshot.battles.map(b => 
          b.id === optimisticBattle.id ? realBattle : b
        );
        this.state$.next({
          ...this.snapshot,
          battles: updatedBattles
        });
        
        // Add battle log entry
        this.battleService.addLocalLog(realBattle);
      }),
      catchError(err => {
        // Rollback on error
        this.state$.next(previousState);
        this.error.set('Failed to log battle. Please try again.');
        return throwError(() => err);
      })
    );
  }

  updateTrainerProfile(trainerId: number, changes: Partial<Trainer>): void {
    const previousState = { ...this.snapshot, trainers: [...this.snapshot.trainers] };

    const updatedTrainers = this.snapshot.trainers.map(t =>
      t.id === trainerId ? { ...t, ...changes } : t
    );

    this.state$.next({ ...this.snapshot, trainers: updatedTrainers });
    
    // Update current trainer signal if it's the current one
    if (trainerId === this.snapshot.currentTrainerId) {
      this.currentTrainer.set(updatedTrainers.find(t => t.id === trainerId) || null);
    }

    this.trainerService.updateTrainerProfile(trainerId, changes).pipe(
      catchError(err => {
        // Rollback on error
        this.state$.next(previousState);
        this.currentTrainer.set(previousState.trainers.find(t => t.id === trainerId) || null);
        this.error.set('Failed to update profile. Please try again.');
        return throwError(() => err);
      })
    ).subscribe();
  }

  addPokemonToTeam(teamId: number, newPokemonIds: number[]): void {
    const previousState = { 
      ...this.snapshot, 
      teams: this.snapshot.teams.map(t => ({ 
        ...t, 
        pokemon_ids: [...t.pokemon_ids] 
      }))
    };

    const updatedTeams = this.snapshot.teams.map(t => {
      if (t.id !== teamId) return t;
      if (t.pokemon_ids.length + newPokemonIds.length > 6) {
        this.error.set('A team cannot have more than 6 Pokémon.');
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
        // Rollback on error
        this.state$.next(previousState);
        this.teams.set(previousState.teams);
        this.error.set('Failed to sync team with server.');
        return throwError(() => err);
      })
    ).subscribe();
  }

  clearError(): void {
    this.error.set(null);
    this.state$.next({ ...this.snapshot, error: null });
  }

  refreshBattleLogs(): void {
    this.battleService.getBattleLogs().pipe(
      retry(3)
    ).subscribe(logs => {
      this.state$.next({ ...this.snapshot, battleLogs: logs });
    });
  }

  deleteBattleLog(logId: number): void {
    console.log('hello,trainer Store');
    
    const previousState = { ...this.snapshot, battleLogs: [...this.snapshot.battleLogs] };
    const updatedLogs = this.snapshot.battleLogs.filter(log => log.id !== logId);
    this.state$.next({ ...this.snapshot, battleLogs: updatedLogs });
    this.battleService.deleteBattleLog(logId).pipe(
      catchError(err => {
        // Rollback on error
        this.state$.next(previousState);
        this.error.set('Failed to delete battle log from server.');
        return throwError(() => err);
      })
    ).subscribe();
  }
}