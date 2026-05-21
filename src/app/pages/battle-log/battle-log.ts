import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { TrainerDashboardStore } from '../../state/trainer.store';
import { MaterialModule } from '../../shared/material/material-module';


@Component({
  selector: 'app-battle-log',
  standalone: true,
  imports: [CommonModule, MaterialModule, DatePipe],
  templateUrl: './battle-log.html',
  styleUrls: ['./battle-log.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BattleLog {
  private store = inject(TrainerDashboardStore);
  public battles = toSignal(this.store.state.pipe(map(s => s.battles)), { initialValue: [] });
  public logs = toSignal(this.store.state.pipe(map(s => s.battleLogs)), { initialValue: [] });
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
}