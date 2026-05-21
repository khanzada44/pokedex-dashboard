/**
 * GraphQL Query to fetch all historical battle records 
 * and real-time battle event logs from the local mock server.
 */
export const GET_BATTLE_DATA = `
  query GetBattleData {
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
    allBattleLogs {
      id
      battle_id
      timestamp
      message
      severity
    }
  }
`;

/**
 * GraphQL Mutation to insert a new battle result into the local db.
 */
export const LOG_BATTLE_MUTATION = `
  mutation CreateBattle(
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
      team_id
      result
      date
      score_trainer
      score_opponent
    }
  }
`;