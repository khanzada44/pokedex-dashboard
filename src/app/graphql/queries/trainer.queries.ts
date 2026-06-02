export const GET_TRAINER_DASHBOARD = {
  query: `
    query GetTrainerDashboard {
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
  `
};

export const CREATE_NEW_TEAM = {
  query: `
    mutation CreateTeam($name: String!, $trainer_id: ID!, $pokemon_ids: [Int]!, $created_at: String!) {
      createTeam(name: $name, trainer_id: $trainer_id, pokemon_ids: $pokemon_ids, created_at: $created_at) {
        id
        name
        pokemon_ids
      }
    }
  `
};