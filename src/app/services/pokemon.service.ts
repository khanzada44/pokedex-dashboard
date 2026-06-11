import { Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { map, Observable } from 'rxjs';
import { gql } from 'apollo-angular';
import { GET_POKEMONS_QUERY, GET_POKEMON_DETAILS_QUERY, GET_ALL_POKEMON,} from '../graphql/queries/pokemon.queries';

@Injectable({
  providedIn: 'root',
})
export class PokemonService {
  constructor(private apollo: Apollo) {}

  getPokemons(limit: number, offset: number, search: string, type: string): Observable<any> {
    return this.apollo
      .watchQuery({
        query: GET_POKEMONS_QUERY,
        variables: {
          limit,
          offset,
          search: search ? `%${search}%` : '%%',
          type: type ? `%${type}%` : '%%',
        },
      })
      .valueChanges.pipe(map((res: any) => res.data));
  }


  getPokemonDetails(id: number): Observable<any> {
    return this.apollo
      .watchQuery({
        query: GET_POKEMON_DETAILS_QUERY,
        variables: {
          pokemonId: id,
        },
      })
      .valueChanges.pipe(map((res: any) => res.data));
  }


fetchAllPokemon(): Observable<any[]> {
  return this.apollo
    .watchQuery({
      query: GET_ALL_POKEMON,
      fetchPolicy: 'network-only',
    })
    .valueChanges
    .pipe(
      map((res: any) => {
        const list = res?.data?.pokemon_v2_pokemon || [];

        return list.map((p: any) => ({
          ...p,
          sprites:
            typeof p.pokemon_v2_pokemonsprites?.[0]?.sprites === 'string'
              ? JSON.parse(p.pokemon_v2_pokemonsprites[0].sprites)
              : p.pokemon_v2_pokemonsprites?.[0]?.sprites,
        }));
      })
    );
}
}
