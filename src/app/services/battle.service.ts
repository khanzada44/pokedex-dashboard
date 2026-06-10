import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, interval, switchMap, startWith, catchError, of, BehaviorSubject, merge, scan, retry, delay, throwError } from 'rxjs';
import { Battle, BattleLogEntry } from '../models/battle.model';
import { GET_BATTLE_DATA, GET_BATTLE_LOGS_QUERY, GET_BATTLES_QUERY } from '../graphql/queries/battle-log.queries';
import { CREATE_BATTLE_MUTATION, LOG_BATTLE_MUTATION, CREATE_BATTLE_LOG_MUTATION ,DELETE_BATTLE_MUTATION} from '../graphql/mutations/battle-log.mutation';
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
        battles: res.data.battles,
        battleLogs: res.data.battle_log
      })),
      retry(3),
      catchError(err => {
        console.error('Error fetching battle data:', err);
        return of({ battles: [], battleLogs: [] });
      })
    );
  }


  public getBattleLogs(): Observable<BattleLogEntry[]> {
    return this.http.post<{ data: { allBattle_logs: BattleLogEntry[] } }>(
      this.url,
      { query: GET_BATTLE_LOGS_QUERY }
    ).pipe(
      map(res => res.data.allBattle_logs),
      retry(3),
      catchError(() => of([]))
    );
  }

  public getBattles(trainerId?: number): Observable<Battle[]> {
    const query = trainerId 
      ? `query { battles(where: { trainer_id: { _eq: ${trainerId} } }) { id trainer_id opponent_name team_id result date score_trainer score_opponent } }`
      : GET_BATTLES_QUERY;
    
    return this.http.post<{ data: { battles: Battle[] } }>(
      this.api,
      { query }
    ).pipe(
      map((res: any) => res.data.battles),
      retry(3)
    );
  }

  public logBattle(battle: Omit<Battle, 'id'>): Observable<Battle> {
    return this.http.post<{ data: { createBattle: Battle } }>(
      this.url,
      {
        query: LOG_BATTLE_MUTATION,
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
      map(res => res.data.createBattle),
      retry(3),
      delay(500) // Small delay to show loading states
    );
  }

  public createBattleLog(
    battleId: number, 
    message: string, 
    severity: BattleLogEntry['severity']
  ): Observable<BattleLogEntry> {
    return this.http.post<{ data: { createBattle_log: BattleLogEntry } }>(
      this.url,
      {
        query: CREATE_BATTLE_LOG_MUTATION,
        variables: {
          battle_id: battleId,
          message: message,
          severity: severity,
          timestamp: new Date().toISOString()
        }
      }
    ).pipe(
      map(res => res.data.createBattle_log),
      retry(3)
    );
  }

  public pollBattleLogs(intervalMs: number = 5000): Observable<BattleLogEntry[]> {
    const apiPoll$ = interval(intervalMs).pipe(
      startWith(0),
      switchMap(() => this.getBattleLogs()),
      map(logs => {
        const newLogs = logs.filter(log => log.id > this.lastLogId);
        if (newLogs.length) {
          this.lastLogId = logs[logs.length - 1]?.id || 0;
        }
        return newLogs;
      }),
      catchError(() => of([]))
    );

    return merge(apiPoll$, this.manualLogsSubject.asObservable()).pipe(
      scan((acc, curr) => {
        // Keep unique logs by ID and sort by timestamp
        const allLogs = [...acc, ...curr];
        const unique = Array.from(new Map(allLogs.map(item => [item.id, item])).values());
        return unique.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      }, [] as BattleLogEntry[])
    );
  }

  public addLocalLog(battle: Battle): void {
    const newLog: BattleLogEntry = {
      id: Date.now(), // Use timestamp as unique ID
      battle_id: battle.id,
      timestamp: new Date().toISOString(),
      message: ` Battle with ${battle.opponent_name}: ${battle.result === 'win' ? 'VICTORY!' : 'DEFEAT!'} (${battle.score_trainer}-${battle.score_opponent})`,
      severity: battle.result === 'win' ? 'success' : 'danger'
    };
    this.manualLogsSubject.next([newLog]);
  }

  public getLatestLogs(): Observable<BattleLogEntry[]> {
    return this.http.post<{ data: { battle_log: BattleLogEntry[] } }>(
      this.api, 
      { query: GET_BATTLE_LOGS_QUERY }
    ).pipe(
      map((res: any) => res.data.battle_log),
      retry(3)
    );
  }

  public createBattle(b: any): Observable<any> {
    const mutation = CREATE_BATTLE_MUTATION(b);
    return this.http.post(this.api, { query: mutation }).pipe(
      map((res: any) => res.data.createBattle),
      retry(3)
    );
  }
public deleteBattleLog(id: number): Observable<any> {
    console.log('Deleting battle log with ID:', id);
  const body = {
    query: DELETE_BATTLE_MUTATION,
    variables: { id }
  };

  return this.http.post(this.api, body).pipe(
    map((res: any) => {
      console.log('GraphQL response:', res);
      return res.data.deleteBattle;
    }),
    retry(3)
  );
}
}