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
    allLogs {
      id
      battle_id
      timestamp
      message
      severity
    }
  }
`;

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
// 1. All Battles fetch karne ke liye
export const GET_BATTLES_QUERY = `
  query {
    allBattles {
      id
      trainer_id
      opponent_name
      result
      date
      score_trainer
      score_opponent
    }
  }
`;

// 2. Battle Logs fetch karne ke liye
export const GET_BATTLE_LOGS_QUERY = `
  query {
    allBattleLogs { 
      id
      battle_id
      message
      severity
      timestamp
    }
  }
`;

// 3. Battle Create karne ka Mutation
// Note: Variable b object hai jisme data hai
export const CREATE_BATTLE_MUTATION = (b: any) => `
  mutation {
    createBattle(
      trainer_id: ${b.trainer_id},
      opponent_name: "${b.opponent_name}",
      team_id: ${b.team_id},
      result: "${b.result}",
      date: "${b.date}",
      score_trainer: ${b.score_trainer},
      score_opponent: ${b.score_opponent}
    ) {
      id
    }
  }
`;
