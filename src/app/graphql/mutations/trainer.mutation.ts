export const CREATE_NEW_TEAM = {
  query: `
    mutation CreateTeam($name: String!, $trainer_id: ID!, $pokemon_ids: [Int]!, $created_at: String!) {
      createTeam(name: $name, trainer_id: $trainer_id, pokemon_ids: $pokemon_ids, created_at: $created_at) {
        id
        name
        pokemon_ids
        trainer_id
        created_at
      }
    }
  `
};

export const UPDATE_TEAM_MUTATION = {
  query: `
    mutation UpdateTeam($id: ID!, $pokemon_ids: [Int]!) {
      updateTeam(id: $id, pokemon_ids: $pokemon_ids) {
        id
        name
        pokemon_ids
      }
    }
  `
};

export const DELETE_TEAM_MUTATION = {
  query: `
    mutation DeleteTeam($id: ID!) {
      removeTeam(id: $id) {
        id
      }
    }
  `
};

export const LOG_BATTLE_MUTATION = {
  query: `
    mutation LogBattle(
      $trainer_id: ID!,
      $opponent_name: String!,
      $team_id: ID!,
      $result: String!,
      $date: String!,
      $score_trainer: Int!,
      $score_opponent: Int!
    ) {
      createBattle(
        trainer_id: $trainer_id,
        opponent_name: $opponent_name,
        team_id: $team_id,
        result: $result,
        date: $date,
        score_trainer: $score_trainer,
        score_opponent: $score_opponent
      ) {
        id
        trainer_id
        opponent_name
        result
        date
      }
    }
  `
};
