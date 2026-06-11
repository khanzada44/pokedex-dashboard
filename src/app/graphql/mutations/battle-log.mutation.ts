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
      i
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

export const LOG_BATTLE_MUTATION = `
  mutation CreateBattle(
    $trainer_id: Int!, 
    $opponent_name: String!, 
    $team_id: Int!, 
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

export const CREATE_BATTLE_LOG_MUTATION = `
  mutation CreateBattleLog(
    $battle_id: Int!,
    $message: String!,
    $severity: String!,
    $timestamp: String!
  ) {
    createBattle_log(
      battle_id: $battle_id,
      message: $message,
      severity: $severity,
      timestamp: $timestamp
    ) {
      id
      battle_id
      message
      severity
      timestamp
    }
  }
`;

export const UPDATE_BATTLE_MUTATION = `
  mutation UpdateBattle(
    $id: Int!,
    $result: String,
    $score_trainer: Int,
    $score_opponent: Int
  ) {
    updateBattle(
      id: $id,
      result: $result,
      score_trainer: $score_trainer,
      score_opponent: $score_opponent
    ) {
      id
      result
      score_trainer
      score_opponent
    }
  }
`;

export const DELETE_BATTLE_MUTATION = `
  mutation RemoveBattle($id: ID!) {
    removeBattle(id: $id) {
      id
    }
  }
`;
export const UPDATE_BATTLE = `
      mutation UpdateBattle($id: Int!, $input: UpdateBattleInput!) {
        updateBattle(id: $id, input: $input) {
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

