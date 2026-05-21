/**
 * GraphQL Query: Dashboard ka poora data (Trainers, Teams, Battles) 
 * ek sath fetch karne ke liye.
 */
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

/**
 * GraphQL Mutation: Nayi team register karne ke liye.
 */
export const CREATE_NEW_TEAM = {
  query: `
    mutation AddNewTeam($id: ID!, $trainer_id: Int!, $name: String!, $pokemon_ids: [Int!]!, $created_at: String!) {
      createTeam(id: $id, trainer_id: $trainer_id, name: $name, pokemon_ids: $pokemon_ids, created_at: $created_at) {
        id
        name
      }
    }
  `
};