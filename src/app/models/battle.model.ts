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

export interface BattleLogEntry {
  id: number;
  battle_id: number;
  timestamp: string;
  message: string;
  severity: 'success' | 'info' | 'danger';
}

export interface TrainerState {
  battles: Battle[];
  battleLogs: BattleLogEntry[];
  currentTrainerId: number;
  loading: boolean;
}