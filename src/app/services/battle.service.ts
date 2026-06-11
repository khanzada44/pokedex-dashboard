import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, interval, switchMap, startWith, catchError, of, BehaviorSubject, merge, scan, retry, delay, throwError } from 'rxjs';
import { Battle, BattleLogEntry, CreateBattleInput } from '../models/battle.model';
import { GET_BATTLE_DATA, GET_BATTLE_LOGS_QUERY, GET_BATTLES_QUERY ,GET_LATEST_LOGS_QUERY,GET_BATTLES_BY_TRAINER_QUERY} from '../graphql/queries/battle-log.queries';
import { CREATE_BATTLE_MUTATION, LOG_BATTLE_MUTATION, CREATE_BATTLE_LOG_MUTATION, DELETE_BATTLE_MUTATION, UPDATE_BATTLE_MUTATION ,UPDATE_BATTLE} from '../graphql/mutations/battle-log.mutation';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class BattleGraphqlService {
  private readonly http = inject(HttpClient);
  private readonly url = environment.apiUrl;
  private api = environment.apiUrl;
  private manualLogsSubject = new BehaviorSubject<BattleLogEntry[]>([]);
  private lastLogId = 0;

  public getBattleData(): Observable<{ battles: Battle[]; battleLogs: BattleLogEntry[] }> {
    return this.http.post<{ data: { battles: Battle[]; battle_log: BattleLogEntry[] } }>(
      this.url,
      { query: GET_BATTLE_DATA }
    ).pipe(
      map(res => ({
        battles: (res.data as any).allBattles,
        battleLogs: (res.data as any).allBattle_logs
      })),
      retry(3),
      delay(1000),
      catchError(err => {
        console.error('Error fetching battle data:', err);
        return of({ battles: [], battleLogs: [] });
      })
    );
  }

  public getBattleLogs(): Observable<BattleLogEntry[]> {
    return this.http.post<{ data: { allBattleLogs: BattleLogEntry[] } }>(
      this.url,
      { query: GET_BATTLE_LOGS_QUERY }
    ).pipe(
      map(res => (res.data as any).allBattle_logs || []),
      retry(3),
      delay(500),
      catchError(() => of([]))
    );
  }

public getBattles(trainerId?: number): Observable<Battle[]> {
  const query = GET_BATTLES_BY_TRAINER_QUERY;
  
  return this.http.post<{ data: { allBattles: Battle[] } }>(
    this.api,
    { query }
  ).pipe(
    map((res: any) => {
      const battles = res.data?.allBattles || [];
      return trainerId
        ? battles.filter((b: any) => Number(b.trainer_id) === trainerId)
        : battles;
    }),
    retry(3),
    delay(500),
    catchError(error => {
      console.error('Error fetching battles:', error);
      return of([]);
    })
  );
}

public getLatestLogs(): Observable<BattleLogEntry[]> {
  const query = GET_LATEST_LOGS_QUERY;

  return this.http.post<any>(this.url, { query }).pipe(
    map(res => res.data.allBattle_logs || []),
    catchError(err => {
      console.error('GraphQL Errors:', err.error?.errors);
      return throwError(() => err);
    })
  );
}

  public logBattle(battle: Omit<Battle, 'id'>): Observable<Battle> {
    const mutation = LOG_BATTLE_MUTATION;
    return this.http.post<{ data: { createBattle: Battle } }>(
      this.url,
      {
        query: mutation,
        variables: {
          trainer_id: battle.trainer_id,
          opponent_name: battle.opponent_name,
          team_id: battle.team_id,
          result: battle.result,
          date: battle.date,
          score_trainer: battle.score_trainer,
          score_opponent: battle.score_opponent
        }
      }
    ).pipe(
      map(res => {
        if (!res.data?.createBattle) {
          throw new Error('Failed to create battle');
        }
        return res.data.createBattle;
      }),
      retry(2),
      delay(500),
      catchError(error => {
        console.error('Error creating battle:', error);
        return throwError(() => new Error(`Failed to create battle: ${error.message}`));
      })
    );
  }

  public createBattleLog(
    battleId: number, 
    message: string, 
    severity: BattleLogEntry['severity'] 
  ): Observable<BattleLogEntry> {
    const mutation = CREATE_BATTLE_LOG_MUTATION;
    
    return this.http.post<{ data: { createBattleLog: BattleLogEntry } }>(
      this.url,
      {
        query: mutation,
        variables: {
          battle_id: battleId,
          message: message,
          severity: severity,
          timestamp: new Date().toISOString()
        }
      }
    ).pipe(
      map(res => {
        if (!res.data?.createBattleLog) {
          throw new Error('Failed to create battle log');
        }
        return res.data.createBattleLog;
      }),
      retry(3),
      delay(300),
      catchError(error => {
        console.error('Error creating battle log:', error);
        return throwError(() => new Error(`Failed to create battle log: ${error.message}`));
      })
    );
  }

  public pollBattleLogs(intervalMs: number = 5000): Observable<BattleLogEntry[]> {
    const apiPoll$ = interval(intervalMs).pipe(
      startWith(0),
      switchMap(() => this.getLatestLogs()),
      map(logs => {
        const newLogs = logs.filter(log => log.id > this.lastLogId);
        if (newLogs.length > 0) {
          this.lastLogId = Math.max(...logs.map(l => l.id), this.lastLogId);
        }
        return newLogs;
      }),
      catchError(error => {
        console.error('Polling error:', error);
        return of([]);
      })
    );

    return merge(apiPoll$, this.manualLogsSubject.asObservable()).pipe(
      scan((acc, curr) => {
        const allLogs = [...acc, ...curr];
        const unique = Array.from(new Map(allLogs.map(item => [item.id, item])).values());
        return unique.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      }, [] as BattleLogEntry[])
    );
  }

  public addLocalLog(battle: Battle): void {
    const newLog: BattleLogEntry = {
      id: Date.now(),
      battle_id: battle.id,
      timestamp: new Date().toISOString(),
      message: `Battle with ${battle.opponent_name}: ${battle.result === 'win' ? 'VICTORY!' : 'DEFEAT!'} (${battle.score_trainer}-${battle.score_opponent})`,
      severity: battle.result === 'win' ? 'success' : 'danger'
    };
    this.manualLogsSubject.next([newLog]);
  }

  public createBattle(battleData: CreateBattleInput): Observable<Battle> {
    return this.logBattle(battleData);
  }

  public updateBattle(id: number, updates: Partial<Battle>): Observable<Battle> {
    const mutation = UPDATE_BATTLE
    
    return this.http.post<{ data: { updateBattle: Battle } }>(
      this.api,
      {
        query: mutation,
        variables: { id, input: updates }
      }
    ).pipe(
      map((res: any) => {
        if (!res.data?.updateBattle) {
          throw new Error('Failed to update battle');
        }
        return res.data.updateBattle;
      }),
      retry(3),
      catchError(error => {
        console.error('Error updating battle:', error);
        return throwError(() => new Error(`Failed to update battle: ${error.message}`));
      })
    );
  }

  public deleteBattle(id: number): Observable<{ id: number }> {
    const mutation = `
      mutation DeleteBattle($id: Int!) {
        deleteBattle(id: $id) {
          id
        }
      }
    `;
    
    return this.http.post<{ data: { deleteBattle: { id: number } } }>(
      this.api,
      {
        query: mutation,
        variables: { id }
      }
    ).pipe(
      map((res: any) => {
        if (!res.data?.deleteBattle) {
          throw new Error('Failed to delete battle');
        }
        return res.data.deleteBattle;
      }),
      retry(3),
      catchError(error => {
        console.error('Error deleting battle:', error);
        return throwError(() => new Error(`Failed to delete battle: ${error.message}`));
      })
    );
  }

  public deleteBattleLog(id: number): Observable<any> {
    console.log('Deleting battle log with ID:', id);
    const mutation = `
      mutation DeleteBattleLog($id: Int!) {
        deleteBattleLog(id: $id) {
          id
        }
      }
    `;
    
    const body = {
      query: mutation,
      variables: { id }
    };

    return this.http.post(this.api, body).pipe(
      map((res: any) => {
        console.log('GraphQL response:', res);
        if (!res.data?.deleteBattleLog) {
          throw new Error('Failed to delete battle log');
        }
        return res.data.deleteBattleLog;
      }),
      retry(3),
      catchError(error => {
        console.error('Error deleting battle log:', error);
        return throwError(() => new Error(`Failed to delete battle log: ${error.message}`));
      })
    );
  }

  public getBattleStats(trainerId: number): Observable<{
    totalBattles: number;
    wins: number;
    losses: number;
    winRate: number;
    currentStreak: number;
    bestStreak: number;
  }> {
    return this.getBattles(trainerId).pipe(
      map(battles => {
        const totalBattles = battles.length;
        const wins = battles.filter(b => b.result === 'win').length;
        const losses = totalBattles - wins;
        const winRate = totalBattles > 0 ? (wins / totalBattles) * 100 : 0;
        
        let currentStreak = 0;
        let bestStreak = 0;
        let tempStreak = 0;
        
        for (const battle of battles) {
          if (battle.result === 'win') {
            tempStreak++;
            bestStreak = Math.max(bestStreak, tempStreak);
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
          bestStreak
        };
      }),
      catchError(error => {
        console.error('Error calculating battle stats:', error);
        return of({
          totalBattles: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
          currentStreak: 0,
          bestStreak: 0
        });
      })
    );
  }

  public getBattlesByDateRange(startDate: string, endDate: string, trainerId?: number): Observable<Battle[]> {
    return this.getBattles(trainerId).pipe(
      map(battles => battles.filter(battle => 
        battle.date >= startDate && battle.date <= endDate
      )),
      catchError(error => {
        console.error('Error filtering battles by date:', error);
        return of([]);
      })
    );
  }

  public getMonthlyBattleSummary(trainerId: number): Observable<Array<{ month: string; wins: number; losses: number }>> {
    return this.getBattles(trainerId).pipe(
      map(battles => {
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
      }),
      catchError(error => {
        console.error('Error creating monthly summary:', error);
        return of([]);
      })
    );
  }

  public resetPollingState(): void {
    this.lastLogId = 0;
    this.manualLogsSubject.next([]);
  }

  public bulkCreateBattles(battles: CreateBattleInput[]): Observable<Battle[]> {
    const requests = battles.map(battle => this.createBattle(battle));
    return merge(...requests).pipe(
      scan((acc, curr) => [...acc, curr], [] as Battle[]),
      catchError(error => {
        console.error('Error in bulk battle creation:', error);
        return throwError(() => new Error(`Bulk creation failed: ${error.message}`));
      })
    );
  }
}