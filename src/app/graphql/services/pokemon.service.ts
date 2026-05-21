import { Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { GET_POKEMON } from '../queries/pokemon.queries';

@Injectable({
  providedIn: 'root'
})
export class PokemonService {

  constructor(private apollo: Apollo) {}

  getPokemon(
  limit: number,
  offset: number,
  search: string,
  type: string
) {

  return this.apollo.watchQuery({

    query: GET_POKEMON,

    variables: {
      limit,
      offset,

      search: `%${search}%`,
      type: type ? `%${type}%` : `%%`
    }

  }).valueChanges;
}
}