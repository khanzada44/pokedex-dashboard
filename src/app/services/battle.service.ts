import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, interval, switchMap, startWith, catchError, of, BehaviorSubject, merge, scan } from 'rxjs';
import { Battle, BattleLogEntry } from '../models/battle.model';
import { CREATE_BATTLE_MUTATION, GET_BATTLE_DATA, GET_BATTLE_LOGS_QUERY, GET_BATTLES_QUERY, LOG_BATTLE_MUTATION } from '../graphql/queries/battle-log.queries';

@Injectable({
    providedIn: 'root'
})
export class BattleGraphqlService {
    private readonly http = inject(HttpClient);
    private readonly url = 'http://localhost:4000';
    private api = 'http://localhost:4000/graphql';

    // Manual logs add karne ke liye subject
    private manualLogsSubject = new BehaviorSubject<BattleLogEntry[]>([]);

    public getBattleData(): Observable<{ battles: Battle[]; battleLogs: BattleLogEntry[] }> {
        return this.http.post<{ data: { allBattles: Battle[]; allLogs: BattleLogEntry[] } }>(
            this.url,
            { query: GET_BATTLE_DATA }
        ).pipe(
            map(res => ({
                battles: res.data.allBattles,
                battleLogs: res.data.allLogs
            }))
        );
    }

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

    /**
     * Polls the battle logs periodically AND merges with manual local logs
     */
    public pollBattleLogs(intervalMs: number = 5000): Observable<BattleLogEntry[]> {
        const apiPoll$ = interval(intervalMs).pipe(
            startWith(0),
            switchMap(() => this.http.post<{ data?: { allLogs?: BattleLogEntry[] } }>(
                this.url,
                { query: '{ allLogs { id battle_id timestamp message severity } }' }
            )),
            map(res => res?.data?.allLogs || []),
            catchError(() => of([]))
        );

        // merge: Server data aur local manual logs dono ko handle karega
        return merge(apiPoll$, this.manualLogsSubject.asObservable()).pipe(
            scan((acc, curr) => {
                // Agar server se data aaya (array) toh wo current hoga,
                // agar sirf naya item add hua toh wo manual log hoga.
                // Yahan hum unique logs return kar rahe hain based on ID.
                const merged = [...acc, ...curr];
                return Array.from(new Map(merged.map(item => [item.id, item])).values());
            }, [] as BattleLogEntry[])
        );
    }

    public addLocalLog(battle: Battle) {
        const newLog: BattleLogEntry = {
            id: Math.floor(Math.random() * 1_000_000_000), // String ID ensure karen
            battle_id: battle.id,
            timestamp: new Date().toISOString(),
            message: `Battle with ${battle.opponent_name} resulted in a ${battle.result}!`,
            severity: 'info'
        };
        this.manualLogsSubject.next([newLog]); // Sirf naya log push karen
    }

    public getBattles(): Observable<any> {
        return this.http.post(this.api, { query: GET_BATTLES_QUERY }).pipe(
            map((res: any) => res.data.allBattles)
        );
    }

    public getLatestLogs(): Observable<any> {
        return this.http.post(this.api, { query: GET_BATTLE_LOGS_QUERY }).pipe(
            map((res: any) => res.data.allBattle_logs)
        );
    }

    public createBattle(b: any): Observable<any> {
        return this.http.post(this.api, { query: CREATE_BATTLE_MUTATION(b) });
    }
}