import { Component, ChangeDetectionStrategy, inject, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { TrainerDashboardStore } from '../../state/trainer.store';
import { MaterialModule } from '../../shared/material/material-module';
import { BattleGraphqlService } from '../../services/battle.service';
import { Battle } from '../../models/battle.model';

@Component({
  selector: 'app-battle-log',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './battle-log.html',
  styleUrls: ['./battle-log.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BattleLog {
  private store = inject(TrainerDashboardStore);
  private battleService = inject(BattleGraphqlService);
  private cdr = inject(ChangeDetectorRef); // UI force update ke liye

  public battles = toSignal(this.store.state.pipe(map(s => s.battles)), { initialValue: [] });
  public logs = toSignal(this.store.state.pipe(map(s => s.battleLogs)), { initialValue: [] });
  
  // Service ki nai logic ke sath ab ye automatically sync hoga
  public liveLogs = toSignal(this.battleService.pollBattleLogs(5000), { initialValue: [] });

  public displayedColumns: string[] = ['opponent', 'result', 'score'];

  public winRate = computed(() => {
    const b = this.battles();
    if (b.length === 0) return '0.0';
    const wins = b.filter(x => x.result === 'win').length;
    return ((wins / b.length) * 100).toFixed(1);
  });

  constructor() {
    this.store.loadDashboardData();
  }

  public startTestBattle() {
    const mockBattle: Omit<Battle, 'id'> = {
      trainer_id: 1,
      opponent_name: 'Gary Oak',
      team_id: 1,
      result: 'win',
      date: new Date().toISOString(),
      score_trainer: 3,
      score_opponent: 1
    };

    this.battleService.logBattle(mockBattle).subscribe({
      next: (response) => {
        console.log('Battle saved!', response);
        
        // 1. Store refresh karen
        this.store.loadDashboardData();
        
        // 2. Service mein manual log push karen (ye turant UI update karega)
        this.battleService.addLocalLog(response);

        // 3. Force trigger detection (Optional, safety ke liye)
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error:', err)
    });
  }
}