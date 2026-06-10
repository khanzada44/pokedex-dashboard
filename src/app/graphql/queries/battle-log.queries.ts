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

  battle_log {
    id
    battle_id
    timestamp
    message
    severity
  }
}
`;

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

export const GET_BATTLE_LOGS_QUERY = `
  query {
    allBattle_logs {
      id
      battle_id
      message
      severity
      timestamp
    }
  }
`;
