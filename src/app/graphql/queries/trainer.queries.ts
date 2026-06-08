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

export const GET_BATTLE_LOGS = {
  query: `
    query GetBattleLogs {
      allBattle_logs {
        id
        battle_id
        timestamp
        message
        severity
      }
    }
  `
};