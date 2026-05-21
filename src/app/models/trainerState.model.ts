import { Trainer } from "./trainer.model";
import { Team } from "./team.model";
import { Battle } from "./battle.model";

export interface TrainerState {
  currentTrainerId: number;
  trainers: Trainer[];
  teams: Team[];
  battles: Battle[];
  loading: boolean;
  error: string | null;
}