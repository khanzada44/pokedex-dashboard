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