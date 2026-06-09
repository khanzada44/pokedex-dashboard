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

@Injectable({ providedIn: 'root' })
export class TrainerService {

  private readonly apiUrl = 'http://localhost:4000/graphql';
  private readonly http   = inject(HttpClient);

  /**
   * Fetches the full trainer dashboard: trainers, teams, and battles.
   *
   * @returns Observable with allTrainers, allTeams, allBattles arrays
   */
  getTrainerDashboard(): Observable<any> {
    return this.http.post<any>(this.apiUrl, {
      query: GET_TRAINER_DASHBOARD.query
    });
  }

  /**
   * Fetches all Pokémon-related trainer data (legacy query, kept for compatibility).
   *
   * @returns Observable with raw GraphQL response
   */
  getTrainerDashboardData(): Observable<any> {
    return this.http.post<any>(this.apiUrl, {
      query: GET_TRAINER_DATA_QUERY
    });
  }

  /**
   * Creates a new team record in the local GraphQL server.
   *
   * @param teamPayload - Team object including name, trainer_id, pokemon_ids, created_at
   * @returns Observable with the created team
   */
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

  /**
   * Updates the pokemon_ids array of an existing team.
   *
   * @param id         - Team ID as string
   * @param pokemonIds - New array of Pokédex IDs
   * @returns Observable with the updated team
   */
  updateTeam(id: string, pokemonIds: number[]): Observable<any> {
    return this.http.post<any>(this.apiUrl, {
      query: UPDATE_TEAM_MUTATION.query,
      variables: { id, pokemon_ids: pokemonIds }
    });
  }

  /**
   * Deletes a team by its ID from the local server.
   *
   * @param id - Team ID as string
   * @returns Observable confirming deletion
   */
  deleteTeam(id: string): Observable<any> {
    return this.http.post<any>(this.apiUrl, {
      query: DELETE_TEAM_MUTATION.query,
      variables: { id }
    });
  }

  /**
   * Logs a new battle result via the createBattle mutation.
   *
   * @param payload - Battle fields without the ID
   * @returns Observable with the created battle record
   */
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

  /**
   * Updates trainer profile fields (name, region, badge_count).
   * NOTE: json-graphql-server exposes updateTrainer mutation automatically.
   *
   * @param id      - Trainer ID
   * @param changes - Partial trainer fields to update
   * @returns Observable with the updated trainer
   */
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

  /**
   * Fetches all battle log entries.
   *
   * @returns Observable with allBattle_logs array
   */
  getBattleLogs(): Observable<any> {
    return this.http.post<any>(this.apiUrl, {
      query: GET_BATTLE_LOGS.query
    });
  }

  /**
   * Fetches all teams (used by async team-name uniqueness validator).
   *
   * @returns Observable with allTeams array
   */
  fetchTeams(): Observable<any> {
    return this.http.post<any>(this.apiUrl, {
      query: '{ allTeams { id name pokemon_ids trainer_id created_at } }'
    });
  }
}