import { Component, signal, inject, OnInit, DestroyRef, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BattleGraphqlService } from '../../services/battle.service';
import { interval, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MaterialModule } from '../../shared/material/material-module';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-battle',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './battle.html',
  styleUrls: ['./battle.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Battle implements OnInit {
  private service = inject(BattleGraphqlService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);
  public battles = signal<any[]>([]);
  public liveLogs = signal<any[]>([]);

  public winRate = computed(() => {
    const total = this.battles().length;
    const wins = this.battles()?.filter(b => b.result === 'win').length || 0;
    return total > 0 ? Math.round((wins / total) * 100) : 0;
  });

  ngOnInit(): void {
    this.loadBattles();
    this.startPolling();
  }

public loadBattles(): void {
  this.service.getBattles().subscribe({
    next: (res: any) => {
      const data = res?.data?.allBattles || []; 
      this.battles.set([...data]);
      console.log('UI Data updated:', this.battles());
    },
    error: (err) => console.error("Error:", err)
  });
}

  public startPolling(): void {
    interval(5000).pipe(
      switchMap(() => this.service.getLatestLogs()),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (logs: any) => this.liveLogs.set(logs || []),
      error: (err) => console.error("Polling error:", err)
    });
  }
}