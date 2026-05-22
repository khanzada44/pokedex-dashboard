import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
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
    fetchAllPokemon(): Observable<any[]> {
  const query = `
    query GetPokemon {
      pokemon_v2_pokemon(limit: 100) {
        id
        name
        pokemon_v2_pokemonsprites {
          sprites
        }
      }
    }
  `;
  
  // Apne existing GraphQL client (Apollo ya direct HTTP) ka use karein
  return this.http.post<any>('https://beta.pokeapi.co/graphql/v1beta', { query }).pipe(
    map(res => res.data.pokemon_v2_pokemon.map((p: any) => ({
      ...p,
      sprites: typeof p.pokemon_v2_pokemonsprites[0].sprites === 'string' 
           ? JSON.parse(p.pokemon_v2_pokemonsprites[0].sprites) 
           : p.pokemon_v2_pokemonsprites[0].sprites // JSON format fix
    })))
  );
}
}