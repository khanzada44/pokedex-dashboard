import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {  Observable } from 'rxjs';
import { GET_TRAINER_DATA_QUERY } from '../graphql/queries/pokemon.queries';
import { GET_TRAINER_DASHBOARD, CREATE_NEW_TEAM } from '../graphql/queries/trainer.queries';
import { UPDATE_TEAM_MUTATION } from '../graphql/mutations/pokemon.mutation';

@Injectable({
  providedIn: 'root'
})
export class TrainerService {
  private readonly apiUrl = 'http://localhost:4000/graphql'; // /graphql add kar diya
  private readonly http = inject(HttpClient);

  // Store ko yahan se remove kar diya gaya hai (Circular dependency khatam!)

  getTrainerDashboardData(): Observable<any> {
    return this.http.post<any>(this.apiUrl, { query: GET_TRAINER_DATA_QUERY });
  }

  updateTeam(id: string, pokemonIds: number[]): Observable<any> {
    return this.http.post<any>(this.apiUrl, {
      query: UPDATE_TEAM_MUTATION,
      variables: { id, pokemon_ids: pokemonIds }
    });
  }

  getTrainerDashboard(): Observable<any> {
    return this.http.post<any>(this.apiUrl, { query: GET_TRAINER_DASHBOARD.query });
  }

  createNewTeam(teamPayload: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, {
      query: CREATE_NEW_TEAM.query,
      variables: teamPayload
    });
  }


fetchTeams(): Observable<any> {
  return this.http.post<any>(this.apiUrl, {
    query: '{ allTeams { id, name, pokemon_ids } }' 
  });
}

}