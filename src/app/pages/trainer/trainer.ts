import { Component, inject, OnInit, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Sidebar } from '../../layout/sidebar/sidebar';
import { MaterialModule } from '../../shared/material/material-module';
import { TrainerDashboardStore, LocalTrainerState } from '../../state/trainer.store';
import { Team } from '../../models/team.model';
import { Battle } from '../../models/battle.model';
import { Trainer as TrainerModel } from '../../models/trainer.model';

@Component({
  selector: 'app-trainer',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Sidebar, MaterialModule],
  templateUrl: './trainer.html',
  styleUrl: './trainer.scss'
})
export class Trainer implements OnInit {
  private store = inject(TrainerDashboardStore);
  private fb = inject(FormBuilder);

  teamForm!: FormGroup;
  competitiveMode = signal<boolean>(false);

  // FIX 2: Generic parameter hata kar strict initial object assignment di hai taake Overload signature error khatam ho jaye
  stateSignal = toSignal(this.store.state, {
    initialValue: {
      currentTrainerId: 1,
      trainers: [] as TrainerModel[], // Sahi renamed model cast kiya
      teams: [] as Team[],
      battles: [] as Battle[],
      loading: false,
      error: null as string | null
    } as LocalTrainerState
  });

  // FIX 3: Refactored computed signals with safe navigation and TrainerModel check layers
  activeTrainer = computed(() => {
    const state = this.stateSignal();
    if (!state || !state.trainers) return null;
    return state.trainers.find((t: TrainerModel) => t.id === state.currentTrainerId) || null;
  });

  trainerTeams = computed(() => {
    const state = this.stateSignal();
    if (!state || !state.teams) return [] as Team[];
    return state.teams.filter((t: Team) => t.trainer_id === state.currentTrainerId);
  });

  winRateAnalysis = computed(() => {
    const state = this.stateSignal();
    if (!state || !state.battles) return { wins: 0, losses: 0, total: 0, percentage: 0 };

    const trainerBattles = state.battles.filter((b: Battle) => b.trainer_id === state.currentTrainerId);
    const total = trainerBattles.length;
    
    if (total === 0) return { wins: 0, losses: 0, total: 0, percentage: 0 };

    const wins = trainerBattles.filter((b: Battle) => b.result === 'win').length;
    const losses = total - wins;
    const percentage = Math.round((wins / total) * 100);

    return { wins, losses, total, percentage };
  });

  constructor() {
    effect(() => {
      const trainer = this.activeTrainer();
      if (trainer) {
        localStorage.setItem('active_trainer_id', trainer.id.toString());
      }
    });
  }

  ngOnInit(): void {
    const cachedTrainerId = localStorage.getItem('active_trainer_id');
    if (cachedTrainerId) {
      this.store.setTrainerId(parseInt(cachedTrainerId, 10));
    }
    this.store.loadDashboardData();
    this.buildTeamReactiveForm();
  }

  private buildTeamReactiveForm(): void {
    this.teamForm = this.fb.group({
      teamName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(30)]],
      pokemonSlots: this.fb.array([], [Validators.required, Validators.minLength(1)])
    });
  }

  get pokemonSlots(): FormArray {
    return this.teamForm.get('pokemonSlots') as FormArray;
  }

  addPokemonSlot(pokemonId: number, name: string): void {
    if (this.pokemonSlots.length >= 6) {
      alert('Trainer Squad configurations limit capped at 6 items slots maxima.');
      return;
    }
    const subGroupControl = this.fb.group({
      pokemonId: [pokemonId],
      pokemonName: [name],
      nickname: ['', [Validators.maxLength(12)]],
      heldItem: ['None']
    });
    this.pokemonSlots.push(subGroupControl);
  }

  removePokemonSlot(index: number): void {
    this.pokemonSlots.removeAt(index);
  }

  toggleCompetitiveMode(): void {
    this.competitiveMode.set(!this.competitiveMode());
  }

  onFormSubmit(): void {
    if (this.teamForm.invalid) return;
    const values = this.teamForm.value;
    const isolatedIdsArray = (values.pokemonSlots as Array<{ pokemonId: number }>).map(p => p.pokemonId);

    this.store.saveTrainerTeam(values.teamName, isolatedIdsArray);
    this.teamForm.reset();
    this.pokemonSlots.clear();
  }

  switchActiveTrainer(id: number): void {
    this.store.setTrainerId(id);
    this.pokemonSlots.clear(); 
  }
}