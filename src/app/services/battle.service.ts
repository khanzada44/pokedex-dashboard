import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Battle, BattleLogEntry } from '../models/battle.model';
import { GET_BATTLE_DATA, LOG_BATTLE_MUTATION } from '../graphql/queries/battle-log.queries';

@Injectable({
  providedIn: 'root'
})
export class BattleGraphqlService {
  private readonly http = inject(HttpClient);
  private readonly url = 'http://localhost:4000'; // Local Mock Server Endpoint

  /**
   * Sends a POST request to execute the GET_BATTLE_DATA GraphQL query.
   * 
   * @returns Observable<{ battles: Battle[], battleLogs: BattleLogEntry[] }>
   */
  public getBattleData(): Observable<{ battles: Battle[]; battleLogs: BattleLogEntry[] }> {
    return this.http.post<{ data: { allBattles: Battle[]; allBattleLogs: BattleLogEntry[] } }>(
      this.url, 
      { query: GET_BATTLE_DATA }
    ).pipe(
      map(res => ({
        battles: res.data.allBattles,
        battleLogs: res.data.allBattleLogs
      }))
    );
  }

  /**
   * Executes the GraphQL mutation to save a new battle record.
   * 
   * @param battle - Omit<Battle, 'id'> new battle payload without ID
   * @returns Observable<Battle> - Server saved battle entry
   */
  public logBattle(battle: Omit<Battle, 'id'>): Observable<Battle> {
    return this.http.post<{ data: { createBattle: Battle } }>(
      this.url, 
      {
        query: LOG_BATTLE_MUTATION,
        variables: battle
      }
    ).pipe(
      map(res => res.data.createBattle)
    );
  }
}