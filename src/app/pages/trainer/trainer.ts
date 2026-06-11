import { Component, inject, OnInit, signal, computed, effect, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors, AsyncValidatorFn } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable, of, debounceTime, distinctUntilChanged, switchMap, first } from 'rxjs';
import { Sidebar } from '../../layout/sidebar/sidebar';
import { MaterialModule } from '../../shared/material/material-module';
import { TrainerDashboardStore, LocalTrainerState } from '../../state/trainer.store';
import { Team } from '../../models/team.model';
import { Battle } from '../../models/battle.model';
import { Trainer as TrainerModel } from '../../models/trainer.model';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBar } from '@angular/material/snack-bar';

const TYPE_COLORS: Record<string, string> = {
  fire: '#f97316',
  water: '#3b82f6',
  grass: '#22c55e',
  electric: '#eab308',
  psychic: '#a855f7',
  ice: '#06b6d4',
  dragon: '#6366f1',
  dark: '#374151',
  fighting: '#dc2626',
  poison: '#9333ea',
  ground: '#d97706',
  flying: '#7dd3fc',
  bug: '#84cc16',
  rock: '#a16207',
  ghost: '#7c3aed',
  steel: '#64748b',
  normal: '#94a3b8',
  fairy: '#ec4899',
};

const COMMON_OFFENSIVE_TYPES = ['fire', 'water', 'electric', 'grass', 'ice', 'fighting'];

@Component({
  selector: 'app-trainer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, Sidebar, MaterialModule, MatTabsModule],
  templateUrl: './trainer.html',
  styleUrl: './trainer.scss',
})
export class Trainer implements OnInit {
  private store = inject(TrainerDashboardStore);
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);

  readonly defaultAvatars: string[] = [
    '',
    'https://upload.wikimedia.org/wikipedia/en/e/e4/Ash_Ketchum_Journeys.png',
    'https://upload.wikimedia.org/wikipedia/en/b/b1/MistyEP.png',
    'https://cosplayfu-website.s3.amazonaws.com/_Upload/b/90947-Brock-Harrison-Plush-from-Pokemon.jpg',
  ];

  readonly TIERS = ['OU', 'UU', 'RU', 'NU'] as const;
  readonly HELD_ITEMS = [
    'None',
    'Leftovers',
    'Life Orb',
    'Choice Band',
    'Choice Specs',
    'Rocky Helmet',
    'Eviolite',
    'Focus Sash',
  ];

  competitiveMode = signal<boolean>(false);
  showBattleForm = signal<boolean>(false);
  showProfileForm = signal<boolean>(false);
  activeTab = signal<number>(0);
  deletingTeamId = signal<number | null>(null);
  isSavingTeam = signal<boolean>(false);
  showSaveSuccess = signal<boolean>(false);
  lastSavedTeam = signal<string>('');

  stateSignal = toSignal(this.store.state, {
    initialValue: {
      currentTrainerId: 1,
      trainers: [] as TrainerModel[],
      teams: [] as Team[],
      battles: [] as Battle[],
      battleLogs: [] as any[],
      loading: false,
      error: null as string | null,
    } as LocalTrainerState,
  });

  activeTrainer = computed(() => {
    const state = this.stateSignal();
    if (!state?.trainers?.length) return null;
    return state.trainers.find((t: TrainerModel) => t.id === state.currentTrainerId) ?? null;
  });

  trainerTeams = computed(() => {
  const allTeams = this.store.teams(); 
    const currentId = this.stateSignal().currentTrainerId;
    console.log(' trainerTeams computed:', { allTeams, currentId });
    return allTeams.filter((t: Team) => t.trainer_id === currentId);
  });

  winRateAnalysis = computed(() => {
    const state = this.stateSignal();
    if (!state?.battles) return { wins: 0, losses: 0, total: 0, percentage: 0 };

    const trainerBattles = state.battles.filter(
      (b: Battle) => b.trainer_id === state.currentTrainerId,
    );
    const total = trainerBattles.length;
    if (total === 0) return { wins: 0, losses: 0, total: 0, percentage: 0 };

    const wins = trainerBattles.filter((b: Battle) => b.result === 'win').length;
    const losses = total - wins;
    const percentage = Math.round((wins / total) * 100);

    return { wins, losses, total, percentage };
  });

  battleChartData = computed(() => {
    const state = this.stateSignal();
    if (!state?.battles) return [];

    const trainerBattles = state.battles.filter(
      (b: Battle) => b.trainer_id === state.currentTrainerId,
    );

    const monthMap: Record<string, { wins: number; losses: number }> = {};

    trainerBattles.forEach((b: Battle) => {
      const monthKey = b.date ? b.date.substring(0, 7) : 'Unknown';
      if (!monthMap[monthKey]) monthMap[monthKey] = { wins: 0, losses: 0 };
      if (b.result === 'win') monthMap[monthKey].wins++;
      else monthMap[monthKey].losses++;
    });

    return Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, data]) => ({
        month: this._formatMonthLabel(month),
        wins: data.wins,
        losses: data.losses,
      }));
  });

  teamTypeDistribution = computed(() => {
    const teams = this.trainerTeams();
    if (!teams.length) return [] as { type: string; count: number; color: string }[];

    const typeCountMap: Record<string, number> = {};
    const demoTypes = ['water', 'fire', 'grass', 'electric', 'dragon', 'ice', 'normal', 'psychic'];

    if (teams[0] && teams[0].pokemon_ids) {
      teams[0].pokemon_ids.forEach((id: number) => {
        const demoType = demoTypes[id % demoTypes.length];
        typeCountMap[demoType] = (typeCountMap[demoType] || 0) + 1;
      });
    }

    return Object.entries(typeCountMap).map(([type, count]) => ({
      type,
      count,
      color: TYPE_COLORS[type] ?? '#94a3b8',
    }));
  });

  typeWeaknessGap = computed(() => {
    const teams = this.trainerTeams();
    if (!teams.length) return [] as string[];

    const covered = new Set(
      teams[0].pokemon_ids.map((id: number) => {
        const demoTypes = ['water', 'fire', 'grass', 'electric', 'dragon', 'ice'];
        return demoTypes[id % demoTypes.length];
      }),
    );

    return COMMON_OFFENSIVE_TYPES.filter((t) => !covered.has(t));
  });

  activeBattles = computed(() => {
    const state = this.stateSignal();
    if (!state?.battles) return [] as Battle[];
    return state.battles.filter((b: Battle) => b.trainer_id === state.currentTrainerId);
  });

  liveBattleLogs = computed(() => {
    const state = this.stateSignal();
    return state?.battleLogs ?? [];
  });

  canSaveTeam = computed(() => {
    const formValid = this.teamForm?.valid ?? false;
    const hasPokemon = this.pokemonSlots?.length > 0;
    const notSaving = !this.isSavingTeam();
    return formValid && hasPokemon && notSaving;
  });

  teamForm!: FormGroup;
  battleLogForm!: FormGroup;
  profileForm!: FormGroup;

  constructor() {
    effect(() => {
      const trainer = this.activeTrainer();
      if (trainer && typeof window !== 'undefined') {
        localStorage.setItem('active_trainer_id', trainer.id.toString());
      }
    });

    effect(() => {
      const trainer = this.activeTrainer();
      if (trainer && this.profileForm) {
        this.profileForm.patchValue(
          {
            name: trainer.name,
            region: trainer.region,
            badge_count: trainer.badge_count,
          },
          { emitEvent: false },
        );
      }
    });
  }

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      const cached = window.localStorage.getItem('active_trainer_id');
      if (cached) this.store.setTrainerId(parseInt(cached, 10));
    }

    this.store.loadDashboardData();
    this._buildTeamForm();
    this._buildBattleLogForm();
    this._buildProfileForm();
  }

  private _buildTeamForm(): void {
    this.teamForm = this.fb.group({
      teamName: [
        '',
        [Validators.required, Validators.minLength(3), Validators.maxLength(30)],
        [this._uniqueTeamNameValidator()],
      ],
      competitiveTier: ['OU'],
      pokemonSlots: this.fb.array([], [Validators.required]),
    });
  }

  private _buildBattleLogForm(): void {
    this.battleLogForm = this.fb.group({
      opponent_name: ['', [Validators.required, Validators.minLength(2)]],
      team_id: [null, Validators.required],
      result: ['win', Validators.required],
      score_trainer: [0, [Validators.required, Validators.min(0), Validators.max(6)]],
      score_opponent: [0, [Validators.required, Validators.min(0), Validators.max(6)]],
      date: [new Date().toISOString().substring(0, 10), Validators.required],
    });
  }

  private _buildProfileForm(): void {
    const t = this.activeTrainer();
    this.profileForm = this.fb.group({
      name: [t?.name ?? '', [Validators.required, Validators.minLength(3)]],
      region: [t?.region ?? '', Validators.required],
      badge_count: [
        t?.badge_count ?? 0,
        [Validators.required, Validators.min(0), Validators.max(8)],
      ],
    });
  }

  private _uniqueTeamNameValidator(): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      if (!control.value) return of(null);

      return of(control.value).pipe(
        debounceTime(400),
        distinctUntilChanged(),
        switchMap((name: string) => {
          const exists = this.stateSignal().teams.some(
            (t: Team) => t.name.toLowerCase() === name.toLowerCase(),
          );
          return of(exists ? { nameTaken: true } : null);
        }),
        first(),
      );
    };
  }

  get pokemonSlots(): FormArray {
    return this.teamForm.get('pokemonSlots') as FormArray;
  }

  getAvatar(index: number): string {
    return this.defaultAvatars[index] ?? this.defaultAvatars[0];
  }

  getTypeColor(type: string): string {
    return TYPE_COLORS[type.toLowerCase()] ?? '#94a3b8';
  }

  getSeverityClass(severity: string): string {
    const map: Record<string, string> = {
      success: 'log-success',
      danger: 'log-danger',
      info: 'log-info',
    };
    return map[severity] ?? 'log-info';
  }

  addPokemonSlot(pokemonId: number, name: string, primaryType = 'normal'): void {
    if (this.pokemonSlots.length >= 6) return;

    const slotGroup = this.fb.group({
      pokemonId: [pokemonId],
      pokemonName: [name],
      pokemonType: [primaryType],
      nickname: ['', Validators.maxLength(12)],
      heldItem: ['None'],
      evSpread: this.fb.group({
        hp: [0, [Validators.min(0), Validators.max(252)]],
        atk: [0, [Validators.min(0), Validators.max(252)]],
        def: [0, [Validators.min(0), Validators.max(252)]],
        spAtk: [0, [Validators.min(0), Validators.max(252)]],
        spDef: [0, [Validators.min(0), Validators.max(252)]],
        speed: [0, [Validators.min(0), Validators.max(252)]],
      }),
    });

    this.pokemonSlots.push(slotGroup);
  }

  removePokemonSlot(index: number): void {
    this.pokemonSlots.removeAt(index);
  }

  toggleCompetitiveMode(): void {
    this.competitiveMode.update((v) => !v);
  }

  onTeamFormSubmit(): void {
    if (this.teamForm.invalid) {
      this.teamForm.markAllAsTouched();
      this.snackBar.open('Please fix form errors before saving', 'Close', { duration: 3000 });
      return;
    }

    const slots = this.pokemonSlots.value;
    if (!slots || slots.length === 0) {
      this.snackBar.open('Add at least 1 Pokemon to your team', 'Close', { duration: 3000 });
      return;
    }

    const teamName = this.teamForm.get('teamName')?.value;
    
    const existingTeam = this.trainerTeams().find(
      t => t.name.toLowerCase() === teamName.toLowerCase()
    );
    
    if (existingTeam) {
      this.snackBar.open(`Team "${teamName}" already exists`, 'Close', { duration: 4000 });
      return;
    }

    this.isSavingTeam.set(true);
    
    const pokemonIds = slots.map((slot: any) => slot.pokemonId);
    const newTeam = {
      id: Date.now(),
      trainer_id: this.stateSignal().currentTrainerId,
      name: teamName,
      pokemon_ids: pokemonIds,
      created_at: new Date().toISOString(),
    };

    this.optimisticallyAddTeam(newTeam);
    
    this.lastSavedTeam.set(teamName);
    this.showSaveSuccess.set(true);
    this.snackBar.open(`Team "${teamName}" saved successfully`, 'Dismiss', { duration: 3000 });
    
    setTimeout(() => {
      this.showSaveSuccess.set(false);
    }, 3000);
    
    this.resetTeamForm();
    this.isSavingTeam.set(false);
  }

  private optimisticallyAddTeam(team: any): void {
    const currentTeams = this.trainerTeams();
    const allTeams = [...this.stateSignal().teams, team];
    this.store.teams.set(allTeams);
    this.store.updateTeamsOptimistically(allTeams);
    console.log('Hello Teams', this.store.teams());
  }

  private resetTeamForm(): void {
    this.teamForm.reset({ teamName: '', competitiveTier: 'OU' });
    while (this.pokemonSlots.length) {
      this.pokemonSlots.removeAt(0);
    }
  }

  onBattleLogSubmit(): void {
    if (this.battleLogForm.invalid) {
      this.battleLogForm.markAllAsTouched();
      return;
    }

    const payload = {
      ...this.battleLogForm.value,
      trainer_id: this.stateSignal().currentTrainerId,
    };

    this.store.logBattle(payload);
    this.battleLogForm.reset({
      result: 'win',
      score_trainer: 0,
      score_opponent: 0,
      date: new Date().toISOString().substring(0, 10),
    });
    this.showBattleForm.set(false);
    this.snackBar.open('Battle logged successfully', 'Close', { duration: 2000 });
  }

  onProfileUpdate(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.store.updateTrainerProfile(this.stateSignal().currentTrainerId, this.profileForm.value);
    this.showProfileForm.set(false);
    this.snackBar.open('Profile updated successfully', 'Close', { duration: 2000 });
  }

  confirmDeleteTeam(teamId: number): void {
    this.store.deleteTeam(teamId);
    this.deletingTeamId.set(null);
    this.snackBar.open('Team deleted successfully', 'Close', { duration: 2000 });
  }

  switchActiveTrainer(id: number): void {
    this.store.setTrainerId(id);
    this.resetTeamForm();
    this.showBattleForm.set(false);
    this.showProfileForm.set(false);
  }

  getEvTotal(slotIndex: number): number {
    const ev = (this.pokemonSlots.at(slotIndex) as FormGroup).get('evSpread')?.value;
    if (!ev) return 0;
    return Object.values(ev as Record<string, number>).reduce((a, b) => a + (b ?? 0), 0);
  }

  buildDonutStyle(): string {
    const data = this.teamTypeDistribution();
    if (!data.length) return '';

    const total = data.reduce((s, d) => s + d.count, 0);
    let cumulative = 0;
    const stops = data
      .map((entry) => {
        const start = (cumulative / total) * 360;
        cumulative += entry.count;
        const end = (cumulative / total) * 360;
        return `${entry.color} ${start}deg ${end}deg`;
      })
      .join(', ');

    return `background: conic-gradient(${stops})`;
  }

  buildRadialStyle(percentage: number): string {
    const deg = (percentage / 100) * 360;
    return `background: conic-gradient(#22c55e ${deg}deg, #e2e8f0 ${deg}deg)`;
  }

  private _formatMonthLabel(iso: string): string {
    const [year, month] = iso.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  }
}