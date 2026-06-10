import { Component, ChangeDetectionStrategy, inject, computed, signal, OnInit, OnDestroy, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map, distinctUntilChanged } from 'rxjs/operators';
import { FormBuilder, FormGroup, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { TrainerDashboardStore } from '../../state/trainer.store';
import { MaterialModule } from '../../shared/material/material-module';
import { BattleGraphqlService } from '../../services/battle.service';
import { Battle, BattleLogEntry } from '../../models/battle.model';
import { Team } from '../../models/team.model';

@Component({
  selector: 'app-battle-log',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './battle-log.html',
  styleUrls: ['./battle-log.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BattleLog implements OnInit {
  private store = inject(TrainerDashboardStore);
  private battleService = inject(BattleGraphqlService);
  private snackBar = inject(MatSnackBar);
  private fb = inject(FormBuilder);

  isLoading = signal(false);
  isSubmitting = signal(false);
  selectedBattleId = signal<number | null>(null);
  showBattleForm = signal(false);
  filterSeverity = signal<string>('all');


  private opponentsList = [
    'Gary Oak', 'Cynthia', 'Lance', 'Red', 'Blue', 
    'Steven Stone', 'Diantha', 'Leon', 'Professor Oak', 
    'Misty', 'Brock', 'Giovanni', 'Wallace', 'May', 'Dawn'
  ];
  public battles = toSignal(
    this.store.state.pipe(
      map(s => s.battles),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
    ),
    { initialValue: [] as Battle[] }
  );

  /** Battle logs from store */
  public logs = toSignal(
    this.store.state.pipe(
      map(s => s.battleLogs),
      distinctUntilChanged()
    ),
    { initialValue: [] as BattleLogEntry[] }
  );

  /** Teams from store - for team selection */
  public teams = toSignal(
    this.store.state.pipe(
      map(s => s.teams),
      distinctUntilChanged()
    ),
    { initialValue: [] as Team[] }
  );

  /** Loading state from store */
  public storeLoading = toSignal(
    this.store.state.pipe(map(s => s.loading)),
    { initialValue: false }
  );

  /** Error state from store */
  public storeError = toSignal(
    this.store.state.pipe(map(s => s.error)),
    { initialValue: null }
  );

  public liveLogs = toSignal(
    this.battleService.pollBattleLogs(5000),
    { initialValue: [] as BattleLogEntry[] }
  );

  public winRate = computed(() => {
    const b = this.battles();
    if (b.length === 0) return '0.0';
    const wins = b.filter(x => x.result === 'win').length;
    return ((wins / b.length) * 100).toFixed(1);
  });


  public totalBattles = computed(() => this.battles().length);
  public winCount = computed(() => this.battles().filter(b => b.result === 'win').length);
  public lossCount = computed(() => this.battles().filter(b => b.result === 'loss').length);
  public recentBattles = computed(() => {
    return [...this.battles()]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  });
  public filteredLogs = computed(() => {
    const allLogs = this.liveLogs();
    const severity = this.filterSeverity();
    if (severity === 'all') return allLogs;
    return allLogs.filter(log => log.severity === severity);
  });

  public availableTeams = computed(() => {
    const currentTrainerId = this.store.snapshot.currentTrainerId;
    return this.teams().filter(team => team.trainer_id === currentTrainerId);
  });

  /** Can start battle? */
  public canStartBattle = computed(() => {
    return !this.isSubmitting() && this.availableTeams().length > 0;
  });

  /** Last battle result for fun message */
  public lastBattleResult = computed(() => {
    const battles = this.battles();
    if (battles.length === 0) return null;
    const lastBattle = [...battles].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];
    return lastBattle;
  });

  public battleForm: FormGroup = this.fb.group({
    opponent_name: ['', [Validators.required, Validators.minLength(2)]],
    team_id: ['', [Validators.required]],
    result: ['win', [Validators.required]],
    score_trainer: [3, [Validators.required, Validators.min(0), Validators.max(3)]],
    score_opponent: [1, [Validators.required, Validators.min(0), Validators.max(3)]],
    notes: ['']
  });

  public displayedColumns: string[] = ['opponent', 'team', 'result', 'score', 'date', 'actions'];

  constructor() {
    // Auto-load dashboard data on init
    this.store.loadDashboardData();
    
    // Subscribe to store error and show snackbar
    this.store.state.pipe(
      map(s => s.error),
      takeUntilDestroyed()
    ).subscribe(error => {
      if (error) {
        this.snackBar.open(error, 'Close', { duration: 5000 });
      }
    });
  }

  ngOnInit(): void {
    this.refreshData();
  }

  refreshData(): void {
    this.isLoading.set(true);
    this.store.loadDashboardData();
    setTimeout(() => this.isLoading.set(false), 500);
  }


  startNewBattle(): void {
    if (this.battleForm.invalid) {
      this.snackBar.open('Please fill all required fields', 'Close', { duration: 3000 });
      return;
    }

    this.isSubmitting.set(true);
    
    const formValue = this.battleForm.value;
    
    // Get selected team name for display
    const selectedTeam = this.availableTeams().find(t => t.id === formValue.team_id);
    
    const newBattle: Omit<Battle, 'id'> = {
      trainer_id: 1,
      opponent_name: formValue.opponent_name,
      team_id: formValue.team_id,
      result: formValue.result as 'win' | 'loss',
      date: new Date().toISOString(),
      score_trainer: formValue.score_trainer,
      score_opponent: formValue.score_opponent
    };

    this.store.logBattle(newBattle).subscribe({
      next: (response) => {
        console.log('Battle saved:', response);
        
        // Show success message
        const resultEmoji = response.result === 'win' ? 'VICTORY!' : 'DEFEAT';
        this.snackBar.open(
          `${resultEmoji} Battle with ${response.opponent_name} recorded! (${response.score_trainer}-${response.score_opponent})`,
          'Close',
          { duration: 4000, panelClass: response.result === 'win' ? 'snackbar-success' : 'snackbar-info' }
        );
        this.battleForm.patchValue({
          result: 'win',
          score_trainer: 3,
          score_opponent: 1,
          notes: ''
        });
        
        this.isSubmitting.set(false);
        this.showBattleForm.set(false);
        
        setTimeout(() => this.refreshData(), 500);
      },
      error: (err) => {
        console.error('Battle error:', err);
        this.snackBar.open('Failed to record battle. Please try again.', 'Close', { duration: 5000 });
        this.isSubmitting.set(false);
      }
    });
  }

  startQuickBattle(): void {
    const randomOpponent = this.opponentsList[Math.floor(Math.random() * this.opponentsList.length)];
    const availableTeams = this.availableTeams();
    
    if (availableTeams.length === 0) {
      this.snackBar.open('Please create a team first!', 'Close', { duration: 3000 });
      return;
    }
    
    const randomTeam = availableTeams[Math.floor(Math.random() * availableTeams.length)];
    const randomResult: 'win' | 'loss' = Math.random() > 0.5 ? 'win' : 'loss';
    const trainerScore = randomResult === 'win' ? Math.floor(Math.random() * 2) + 2 : Math.floor(Math.random() * 2);
    const opponentScore = randomResult === 'win' ? Math.floor(Math.random() * 2) : Math.floor(Math.random() * 2) + 2;

    const quickBattle: Omit<Battle, 'id'> = {
      trainer_id: 1,
      opponent_name: randomOpponent,
      team_id: randomTeam.id,
      result: randomResult,
      date: new Date().toISOString(),
      score_trainer: trainerScore,
      score_opponent: opponentScore
    };

    this.isSubmitting.set(true);

    this.store.logBattle(quickBattle).subscribe({
      next: (response) => {
        console.log('response',response);
        
        this.snackBar.open(
          `Quick battle vs ${response.opponent_name}: ${response.result === 'win' ? 'WIN!' : 'LOSS!'}`,
          'Close',
          { duration: 3000 }
        );
        this.isSubmitting.set(false);
        this.refreshData();
      },
      error: (err) => {
        console.error('Quick battle error:', err);
        this.isSubmitting.set(false);
      }
    });
  }

  viewBattleDetails(battle: Battle): void {
    this.selectedBattleId.set(battle.id);
    // In real app, open a dialog with battle details
    console.log('Viewing battle:', battle);
  }

  deleteBattle(battleId: number): void {
    if (confirm('Are you sure you want to delete this battle record?')) {

      this.battleService.deleteBattleLog(battleId).subscribe({
        next: ( testing) => {
          console.log(testing,'hELLO');
          
          this.snackBar.open('Battle log deleted successfully', 'Close', { duration: 3000 });
          this.refreshData();
        }
      });
    }
  }

  setLogFilter(severity: string): void {
    this.filterSeverity.set(severity);
  }

  exportBattleData(): void {
    const data = {
      battles: this.battles(),
      battleLogs: this.logs(),
      winRate: this.winRate(),
      exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `battle-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    this.snackBar.open('Battle data exported successfully!', 'Close', { duration: 3000 });
  }

  toggleBattleForm(): void {
    this.showBattleForm.update(val => !val);
  }

  getOpponentOptions(): string[] {
    const searchTerm = this.battleForm.get('opponent_name')?.value || '';
    if (!searchTerm) return this.opponentsList.slice(0, 5);
    return this.opponentsList.filter(opp => 
      opp.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }
}