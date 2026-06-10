import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GET_TRAINER_DATA_QUERY } from '../graphql/queries/pokemon.queries';
import { GET_TRAINER_DASHBOARD, GET_BATTLE_LOGS } from '../graphql/queries/trainer.queries';
import {
  UPDATE_TEAM_MUTATION,
  DELETE_TEAM_MUTATION,
  LOG_BATTLE_MUTATION,
  CREATE_NEW_TEAM
} from '../graphql/mutations/trainer.mutation';
import { Trainer } from '../models/trainer.model';
import { Battle } from '../models/battle.model';  
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TrainerService {

  private readonly apiUrl = environment.apiUrl;
  private readonly http   = inject(HttpClient);

  getTrainerDashboard(): Observable<any> {
    return this.http.post<any>(this.apiUrl, {
      query: GET_TRAINER_DASHBOARD.query
    });
  }

  getTrainerDashboardData(): Observable<any> {
    return this.http.post<any>(this.apiUrl, {
      query: GET_TRAINER_DATA_QUERY
    });
  }

  createNewTeam(teamPayload: {
    name: string;
    trainer_id: number;
    pokemon_ids: number[];
    created_at: string;
  }): Observable<any> {
    return this.http.post<any>(this.apiUrl, {
      query: CREATE_NEW_TEAM.query,
      variables: teamPayload
    });
  }

  updateTeam(id: string, pokemonIds: number[]): Observable<any> {
    return this.http.post<any>(this.apiUrl, {
      query: UPDATE_TEAM_MUTATION.query,
      variables: { id, pokemon_ids: pokemonIds }
    });
  }

  deleteTeam(id: string): Observable<any> {
    return this.http.post<any>(this.apiUrl, {
      query: DELETE_TEAM_MUTATION.query,
      variables: { id }
    });
  }

  logBattle(payload: Omit<Battle, 'id'>): Observable<any> {
    return this.http.post<any>(this.apiUrl, {
      query: LOG_BATTLE_MUTATION.query,
      variables: {
        trainer_id:     String(payload.trainer_id),
        opponent_name:  payload.opponent_name,
        team_id:        String(payload.team_id),
        result:         payload.result,
        date:           payload.date,
        score_trainer:  payload.score_trainer,
        score_opponent: payload.score_opponent
      }
    });
  }

  updateTrainerProfile(id: number, changes: Partial<Trainer>): Observable<any> {
    const mutation = `
      mutation UpdateTrainer($id: ID!, $name: String, $region: String, $badge_count: Int) {
        updateTrainer(id: $id, name: $name, region: $region, badge_count: $badge_count) {
          id
          name
          region
          badge_count
          rank
          avatar_url
        }
      }
    `;
    return this.http.post<any>(this.apiUrl, {
      query: mutation,
      variables: { id: String(id), ...changes }
    });
  }

  getBattleLogs(): Observable<any> {
    return this.http.post<any>(this.apiUrl, {
      query: GET_BATTLE_LOGS.query
    });
  }

  fetchTeams(): Observable<any> {
    return this.http.post<any>(this.apiUrl, {
      query: '{ allTeams { id name pokemon_ids trainer_id created_at } }'
    });
  }
}