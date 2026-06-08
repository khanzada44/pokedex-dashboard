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
