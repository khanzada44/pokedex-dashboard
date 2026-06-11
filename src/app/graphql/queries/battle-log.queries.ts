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
    allBattle_logs {
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

export const GET_LATEST_LOGS_QUERY = `
  query GetLatestLogs {
    allBattle_logs {
      id
      battle_id
      timestamp
      message
      severity
    }
  }
`;

export const GET_BATTLES_BY_TRAINER_QUERY = `
  query GetBattles {
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