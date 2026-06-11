import { Injectable, signal, computed, DestroyRef, inject } from '@angular/core';
import { BehaviorSubject, Observable, interval } from 'rxjs';
import { map, distinctUntilChanged, shareReplay, catchError, switchMap, retry } from 'rxjs/operators';
import { Battle, BattleLogEntry, BattleStats, MonthlyBattleData } from '../models/battle.model';
import { BattleGraphqlService } from '../services/battle.service';

@Injectable({ providedIn: 'root' })
export class BattleStore {
  private battleService = inject(BattleGraphqlService);
  
  // BehaviorSubjects
  private battlesSubject = new BehaviorSubject<Battle[]>([]);
  private battleLogsSubject = new BehaviorSubject<BattleLogEntry[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);
  
  // Public observables
  public battles$ = this.battlesSubject.asObservable();
  public battleLogs$ = this.battleLogsSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();
  public error$ = this.errorSubject.asObservable();
  public winRate$ = this.battles$.pipe(
    map(battles => {
      const wins = battles.filter(b => b.result === 'win').length;
      return battles.length ? (wins / battles.length) * 100 : 0;
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );
  
  public recentBattles$ = this.battles$.pipe(
    map(battles => [...battles].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5)),
    shareReplay(1)
  );
  
  // Signals
  public battles = signal<Battle[]>([]);
  public battleLogs = signal<BattleLogEntry[]>([]);
  public isLoading = signal(false);
  public errorMessage = signal<string | null>(null);
  
  public battleStats = computed((): BattleStats => {
    const battles = this.battles();
    const totalBattles = battles.length;
    const wins = battles.filter(b => b.result === 'win').length;
    const losses = totalBattles - wins;
    const winRate = totalBattles > 0 ? (wins / totalBattles) * 100 : 0;
    
    let currentStreak = 0;
    let bestWinStreak = 0;
    let tempStreak = 0;
    
    for (const battle of battles) {
      if (battle.result === 'win') {
        tempStreak++;
        bestWinStreak = Math.max(bestWinStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }
    currentStreak = tempStreak;
    
 return {
    totalBattles,
    wins,
    losses,
    winRate,
    currentStreak,
    bestStreak: bestWinStreak, 
    bestWinStreak
  };
  });
  
  public monthlyBattleData = computed((): MonthlyBattleData[] => {
    const battles = this.battles();
    const monthlyData = new Map<string, { wins: number; losses: number }>();
    
    battles.forEach(battle => {
      const date = new Date(battle.date);
      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
      const current = monthlyData.get(monthKey) || { wins: 0, losses: 0 };
      
      if (battle.result === 'win') {
        current.wins++;
      } else {
        current.losses++;
      }
      monthlyData.set(monthKey, current);
    });
    
    return Array.from(monthlyData.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, data]) => ({
        month,
        wins: data.wins,
        losses: data.losses
      }));
  });
  
  constructor() {
    // Sync signals with subjects
    this.battles$.subscribe(b => this.battles.set(b));
    this.battleLogs$.subscribe(l => this.battleLogs.set(l));
    this.loading$.subscribe(l => this.isLoading.set(l));
    this.error$.subscribe(e => this.errorMessage.set(e));
  }
  
  public loadBattles(trainerId: number): void {
    this.loadingSubject.next(true);
    this.battleService.getBattles(trainerId).pipe(
      retry(3),
      catchError(error => {
        this.errorSubject.next(error.message);
        return ([]);
      })
    ).subscribe(battles => {
      this.battlesSubject.next(battles);
      this.loadingSubject.next(false);
    });
  }
  
  public createBattleWithOptimism(battleData: any): Observable<Battle> {
    return this.battleService.createBattle(battleData);
  }
  
  public deleteBattleWithOptimism(battleId: number): void {
    this.battleService.deleteBattle(battleId).subscribe();
  }
  
  public addLocalBattleLog(battle: Battle): void {
    const newLog: BattleLogEntry = {
      id: Date.now(),
      battle_id: battle.id,
      timestamp: new Date().toISOString(),
      message: `Battle with ${battle.opponent_name}: ${battle.result === 'win' ? 'VICTORY!' : 'DEFEAT!'}`,
      severity: battle.result === 'win' ? 'success' : 'danger'
    };
    const current = this.battleLogsSubject.value;
    this.battleLogsSubject.next([newLog, ...current]);
  }
  
  public pollBattleLogs(intervalMs: number): Observable<BattleLogEntry[]> {
    return interval(intervalMs).pipe(
      switchMap(() => this.battleService.getLatestLogs()),
      map(logs => logs.slice(0, 10))
    );
  }
}