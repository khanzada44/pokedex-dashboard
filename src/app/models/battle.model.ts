export interface Battle {
  id: number;
  trainer_id: number;
  opponent_name: string;
  team_id: number;
  result: 'win' | 'loss';
  date: string;
  score_trainer: number;
  score_opponent: number;
}