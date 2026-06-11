import { 
  Component, 
  OnInit, 
  OnDestroy, 
  inject, 
  signal, 
  computed, 
  effect,
  ChangeDetectionStrategy,
  DestroyRef,
  Inject,
  PLATFORM_ID
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MaterialModule } from '../../shared/material/material-module';
import { CommonModule, DatePipe } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { interval, Subscription } from 'rxjs';
import { BattleStore } from '../../state/battle.store';
import { Battle, BattleLogEntry } from '../../models/battle.model';

@Component({
  selector: 'app-battle',
  standalone: true,
  imports: [
    MaterialModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatSnackBarModule,
    MatDialogModule,
    MatTooltipModule,
    MatBadgeModule,
    DatePipe
  ],
  templateUrl: './battle.html',
  styleUrls: ['./battle.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BattleComponent implements OnInit, OnDestroy {
  private store = inject(BattleStore);
  private destroyRef = inject(DestroyRef);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private fb = inject(FormBuilder);
  private isBrowser: boolean;
  
  public battles = this.store.battles;
  public battleLogs = this.store.battleLogs;
  public isLoading = this.store.isLoading;
  public errorMessage = this.store.errorMessage;
  public battleStats = this.store.battleStats;
  public monthlyBattleData = this.store.monthlyBattleData;
  public selectedBattle = signal<Battle | null>(null);
  public showForm = signal(false);
  public liveLogs = signal<BattleLogEntry[]>([]);
  public displayedColumns = signal<string[]>([
    'sno', 'opponent', 'date', 'score', 'result', 'actions'
  ]);
  

  public winRate = toSignal(this.store.winRate$, { initialValue: 0 });
  public recentBattles = toSignal(this.store.recentBattles$, { initialValue: [] });
  public battleForm: FormGroup;

  private pollingSubscription?: Subscription;

  public winColorClass = computed(() => {
    const rate = this.winRate();
    if (rate >= 70) return 'win-rate-excellent';
    if (rate >= 50) return 'win-rate-good';
    return 'win-rate-poor';
  });

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    

    effect(() => {
      const error = this.errorMessage();
      if (error) {
        this.snackBar.open(error, 'Close', { duration: 5000, panelClass: 'error-snackbar' });
      }
    });

    // Effect: Save battles to localStorage for offline cache (ONLY IN BROWSER)
    effect(() => {
      if (this.isBrowser) {
        const battles = this.battles();
        if (battles && battles.length > 0) {
          try {
            localStorage.setItem('cached_battles', JSON.stringify(battles));
          } catch (e) {
            console.error('Failed to save to localStorage:', e);
          }
        }
      }
    });

    this.battleForm = this.createBattleForm();
  }

  ngOnInit(): void {
    this.loadInitialData();
    this.startLiveLogPolling();
    this.loadCachedData(); // This now has browser check
  }

  ngOnDestroy(): void {
    this.pollingSubscription?.unsubscribe();
  }

  private createBattleForm(): FormGroup {
    return this.fb.group({
      opponent_name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(30)]],
      team_id: ['', Validators.required],
      result: ['win', Validators.required],
      score_trainer: [3, [Validators.required, Validators.min(0), Validators.max(3)]],
      score_opponent: [0, [Validators.required, Validators.min(0), Validators.max(3)]],
      date: [new Date().toISOString().split('T')[0], Validators.required]
    });
  }

  private loadInitialData(): void {
    this.store.loadBattles(1); // Trainer ID 1 for Ash Ketchum
    
    // Subscribe to errors
    this.store.error$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(error => {
      if (error) {
        console.error('Battle load error:', error);
      }
    });
  }

  private startLiveLogPolling(): void {
    this.pollingSubscription = this.store.pollBattleLogs(5000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(freshLogs => {
        if (freshLogs.length > 0) {
          // Update live logs signal (last 20 logs)
          this.liveLogs.set([...freshLogs, ...this.liveLogs()].slice(0, 20));
          
          // Show notification for new battle logs
          freshLogs.slice(0, 3).forEach(log => {
            this.snackBar.open(log.message, 'New!', { duration: 3000, panelClass: 'log-notification' });
          });
        }
      });
  }

  private loadCachedData(): void {
    // Only run in browser environment
    if (!this.isBrowser) {
      console.log('Skipping cache load - not in browser');
      return;
    }
    
    try {
      const cached = localStorage.getItem('cached_battles');
      if (cached && this.battles().length === 0) {
        const cachedBattles = JSON.parse(cached);
        if (cachedBattles && cachedBattles.length > 0) {
          console.log('Loading cached battles for offline mode');
          // Don't override, just show as offline indicator would be implemented here
        }
      }
    } catch (e) {
      console.error('Failed to parse cached battles:', e);
    }
  }

  public onSubmitBattle(): void {
    if (this.battleForm.invalid) {
      this.battleForm.markAllAsTouched();
      this.snackBar.open('Please fill all required fields correctly', 'OK', { duration: 3000 });
      return;
    }

    const battleData = this.battleForm.value;
    battleData.trainer_id = 1; // Current trainer ID
    
    this.store.createBattleWithOptimism(battleData).subscribe({
      next: (battle) => {
        this.snackBar.open(`Battle against ${battle.opponent_name} logged successfully!`, '🎉', { duration: 3000 });
        this.store.addLocalBattleLog(battle);
        this.showForm.set(false);
        this.battleForm.reset();
        this.battleForm.patchValue({
          result: 'win',
          score_trainer: 3,
          score_opponent: 0,
          date: new Date().toISOString().split('T')[0]
        });
      },
      error: (error) => {
        this.snackBar.open(`Failed to log battle: ${error.message}`, 'Close', { duration: 5000 });
      }
    });
  }

  public deleteBattle(battleId: number, battleName: string): void {
    const confirmed = confirm(`Delete battle against ${battleName}? This action cannot be undone.`);
    if (confirmed) {
      this.store.deleteBattleWithOptimism(battleId);
      this.snackBar.open(`Battle against ${battleName} deleted`, '🗑️', { duration: 3000 });
    }
  }

  public viewBattleDetails(battle: Battle): void {
    this.selectedBattle.set(battle);
    // Would open a dialog here with detailed battle logs
    this.snackBar.open(`Battle details: ${battle.opponent_name} - ${battle.result.toUpperCase()}`, 'View', { duration: 2000 });
  }

  public exportBattleData(): void {
    const data = {
      battles: this.battles(),
      stats: this.battleStats(),
      monthlyData: this.monthlyBattleData(),
      exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `battle-data-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    this.snackBar.open('Battle data exported successfully!', '📊', { duration: 3000 });
  }

  public getResultClass(result: string): string {
    return result === 'win' ? 'result-win' : 'result-loss';
  }

  public getResultIcon(result: string): string {
    return result === 'win' ? 'emoji_events' : 'sentiment_dissatisfied';
  }

  public refreshData(): void {
    this.store.loadBattles(1);
    this.snackBar.open('Refreshing battle data...', '-', { duration: 1500 });
  }

  public getLogSeverityClass(severity: string): string {
    const classes: Record<string, string> = {
      success: 'log-success',
      danger: 'log-danger',
      warning: 'log-warning',
      info: 'log-info'
    };
    return classes[severity] || 'log-info';
  }

  public getLogIcon(severity: string): string {
    const icons: Record<string, string> = {
      success: 'check_circle',
      danger: 'error',
      warning: 'warning',
      info: 'info'
    };
    return icons[severity] || 'info';
  }
}