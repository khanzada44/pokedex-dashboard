import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GET_TRAINER_DATA_QUERY, UPDATE_TEAM_MUTATION } from '../graphql/queries/pokemon.queries';
import { GET_TRAINER_DASHBOARD, CREATE_NEW_TEAM } from '../graphql/queries/trainer.queries';

@Injectable({
  providedIn: 'root'
})
export class TrainerService {
  private readonly apiUrl = 'http://localhost:4000'; 
  private readonly http = inject(HttpClient);

  /**
   * Fetches baseline profile configurations, historical battle collections, 
   * and existing team frameworks from the local server pipeline.
   * @returns Observable<any> - Server payload stream
   */
  getTrainerDashboardData(): Observable<any> {
    return this.http.post<any>(this.apiUrl, {
      query: GET_TRAINER_DATA_QUERY
    });
  }

  /**
   * Updates the structural array of Pokémon IDs mapped to an active team row.
   * @param id - The unique target team row identification string
   * @param pokemonIds - Array containing the updated numbers of selected Pokémon
   * @returns Observable<any>
   */
  updateTeam(id: string, pokemonIds: number[]): Observable<any> {
    return this.http.post<any>(this.apiUrl, {
      query: UPDATE_TEAM_MUTATION,
      variables: {
        id: id,
        pokemon_ids: pokemonIds
      }
    });
  }

  /**
   * Fetches the complete trainer profile details, current teams, 
   * and previous battle logs using the Trainer specific GraphQL query context.
   * @returns Observable<any> - Server response stream
   */
  getTrainerDashboard(): Observable<any> {
    return this.http.post<any>(this.apiUrl, {
      query: GET_TRAINER_DASHBOARD.query
    });
  }

  /**
   * Creates a brand new team record on the database under the specified trainer scope.
   * @param teamPayload - Complete team object containing id, trainer_id, name, pokemon_ids, and created_at
   * @returns Observable<any>
   */
  createNewTeam(teamPayload: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, {
      query: CREATE_NEW_TEAM.query,
      variables: teamPayload
    });
  }
}
