import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GET_POKEMONS_QUERY, GET_POKEMON_DETAILS_QUERY } from '../graphql/queries/pokemon.queries';

@Injectable({
    providedIn: 'root'
})
export class PokemonService {
    private readonly apiUrl = 'https://beta.pokeapi.co/graphql/v1beta';
    private readonly http = inject(HttpClient);
    getPokemons(limit: number, offset: number, search: string, type: string): Observable<any> {
        const searchParam = search ? `%${search}%` : '%%';
        const typeParam = type ? `%${type}%` : '%%';

        return this.http.post<any>(this.apiUrl, {
            query: GET_POKEMONS_QUERY,
            variables: {
                limit: limit,
                offset: offset,
                search: searchParam,
                type: typeParam
            }
        });
    }
    getPokemonDetails(id: number): Observable<any> {
        return this.http.post<any>(this.apiUrl, {
            query: GET_POKEMON_DETAILS_QUERY,
            variables: {
                pokemonId: id
            }
        });
    }
}