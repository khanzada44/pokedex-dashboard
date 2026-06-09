import { gql } from 'apollo-angular';

export const GET_POKEMONS_QUERY = gql`
  query GetPokemon(
    $limit: Int,
    $offset: Int,
    $search: String,
    $type: String
  ) {
    pokemon_v2_pokemon(
      limit: $limit,
      offset: $offset,
      where: {
        name: { _ilike: $search },
        pokemon_v2_pokemontypes: {
          pokemon_v2_type: {
            name: { _ilike: $type }
          }
        }
      }
    ) {
      id
      name
      height
      weight
      pokemon_v2_pokemonsprites {
        sprites
      }
      pokemon_v2_pokemontypes {
        pokemon_v2_type {
          name
        }
      }
      pokemon_v2_pokemonstats {
        base_stat
        pokemon_v2_stat {
          name
        }
      }
    }
    pokemon_v2_pokemon_aggregate(
      where: {
        name: { _ilike: $search },
        pokemon_v2_pokemontypes: {
          pokemon_v2_type: {
            name: { _ilike: $type }
          }
        }
      }
    ) {
      aggregate {
        count
      }
    }
  }
`;


export const GET_POKEMON_DETAILS_QUERY = gql`
  query GetPokemonDetails($pokemonId: Int!) {
    pokemon_v2_pokemon_by_pk(id: $pokemonId) {
      id
      name
      height
      weight
      pokemon_v2_pokemonabilities {
        is_hidden
        pokemon_v2_ability {
          name
          pokemon_v2_abilityeffecttexts(where: { language_id: { _eq: 9 } }) {
            effect
            short_effect
          }
        }
      }
      pokemon_v2_pokemonstats {
        base_stat
        pokemon_v2_stat {
          name
        }
      }
      pokemon_v2_pokemonmoves(limit: 10, distinct_on: move_id) {
        pokemon_v2_move {
          name
          power
          accuracy
          pokemon_v2_type {
            name
          }
        }
      }
      pokemon_v2_pokemonspecy {
        pokemon_v2_evolutionchain {
          pokemon_v2_pokemonspecies(order_by: { order: asc }) {
            name
            id
            order
          }
        }
      }
    }
  }
`;


export const GET_TRAINER_DATA_QUERY = `
  query GetTrainerData {
    allTrainers {
      id
      name
      badge_count
      region
      avatar_url
      rank
    }
    allTeams {
      id
      trainer_id
      name
      pokemon_ids
      created_at
    }
    allBattles {
      id
      trainer_id
      opponent_name
      team_id
      result
      date
      score_trainer
      score_opponent
    }
  }
`;

export const GET_ALL_POKEMON = gql`
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