import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  OnInit,
  signal
} from '@angular/core';

import {
  AbstractControl,
  AsyncValidatorFn,
  FormArray,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';

import { CommonModule } from '@angular/common';

import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
  transferArrayItem
} from '@angular/cdk/drag-drop';

import { ScrollingModule } from '@angular/cdk/scrolling';

import {
  debounceTime,
  delay,
  map,
  Observable,
  of,
  retry
} from 'rxjs';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { MaterialModule } from '../../shared/material/material-module';
import { TrainerDashboardStore } from '../../state/trainer.store';
import { TrainerService } from '../../services/trainer.service';
import { PokemonService } from '../../services/pokemon.service';
import { Sidebar } from '../../layout/sidebar/sidebar';

import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-team-builder',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MaterialModule,
    DragDropModule,
    Sidebar,
    ScrollingModule
  ],
  templateUrl: './team-builder.html',
  styleUrl: './team-builder.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamBuilder implements OnInit {

  /**
   * Full Pokémon list from API.
   */
  allPokemon: any[] = [];

  /**
   * Original cached Pokémon list.
   */
  originalPokemonList: any[] = [];

  /**
   * Loading state signal.
   */
  loading = signal(false);

  /**
   * Current active tab.
   */
  activeTab = signal('builder');

  /**
   * Sidebar collapse state.
   */
  sidebarCollapsed = signal(false);

  /**
   * Current trainer ID.
   */
  currentTrainerId = signal(1);

  private snackBar = inject(MatSnackBar);

  private fb = inject(FormBuilder);

  private destroyRef = inject(DestroyRef);

  public store = inject(TrainerDashboardStore);

  private service = inject(TrainerService);

  private pokemonService = inject(PokemonService);

  /**
   * Selected Pokémon signal from store.
   */
  selectedPokemon = this.store.selectedPokemon;

  /**
   * Team Builder Reactive Form.
   */
  teamForm = this.fb.group({
    name: [
      '',
      [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(30)
      ],
      [this.uniqueTeamValidator()]
    ],

    competitiveMode: [false],

    tier: ['OU'],

    pokemonConfigs: this.fb.array([])
  });

  /**
   * Computed team statistics.
   */
  teamStats = computed(() => {
    const squad = this.selectedPokemon();

    return {
      totalPower: squad.reduce(
        (acc, p) => acc + (p.base_stat || 0),
        0
      ),

      typeDistribution: this.getDistribution(squad)
    };
  });

  constructor() {

    /**
     * Persist trainer ID to localStorage.
     */
    effect(() => {
        if (typeof window !== 'undefined') {
          localStorage.setItem(
            'trainerId',
            this.currentTrainerId().toString()
          );
        }
    });

    /**
     * Analytics logging effect.
     */
    effect(() => {
      console.log(
        'Viewed Pokémon:',
        this.selectedPokemon().map(p => p.name)
      );
    });
  }

  /**
   * Initializes component data.
   */
  ngOnInit(): void {

    this.fetchTeams();

    this.fetchPokemon();
  }

  /**
   * Fetches teams from local GraphQL server.
   */
  fetchTeams(): void {

    this.service.fetchTeams()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({

        next: (res: any) => {

          if (res?.data?.allTeams) {

            this.store.teams.set(res.data.allTeams);
          }
        }
      });
  }
noReturnPredicate(): boolean {
  return false;
}
  /**
   * Fetches Pokémon list with retry logic.
   */
  fetchPokemon(): void {

    this.loading.set(true);

    this.pokemonService.fetchAllPokemon()
      .pipe(
        retry({
          count: 3,
          delay: 1000
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({

        next: (data: any[]) => {

          this.allPokemon = data;

          this.originalPokemonList = data;

          this.loading.set(false);
        },

        error: () => {

          this.loading.set(false);

          this.snackBar.open(
            'Failed to load Pokémon',
            'Close',
            { duration: 3000 }
          );
        }
      });
  }

  /**
   * Pokémon config FormArray.
   */
  get pokemonConfigs(): FormArray {

    return this.teamForm.get(
      'pokemonConfigs'
    ) as FormArray;
  }

  /**
   * Async validator for unique team names.
   */
  uniqueTeamValidator(): AsyncValidatorFn {

    return (
      control: AbstractControl
    ): Observable<ValidationErrors | null> => {

      return of(control.value).pipe(

        debounceTime(300),

        delay(500),

        map((name: string) => {

          const exists = this.store
            .allTeams()
            .some(
              team =>
                team.name.toLowerCase()
                === name.toLowerCase()
            );

          return exists
            ? { teamExists: true }
            : null;
        })
      );
    };
  }

  /**
   * Calculates total team power.
   */
  calculateTotalPower(): number {

    return this.selectedPokemon()
      .reduce(
        (acc, p) => acc + (p.base_stat || 0),
        0
      );
  }

  /**
   * Calculates unique type coverage.
   */
  calculateCoverage(): string[] {

    const types = this.selectedPokemon()
      .map(p => p.type || 'Normal');

    return Array.from(new Set(types));
  }

  /**
   * Loads an existing team.
   */
  loadTeam(team: any): void {

    this.teamForm.patchValue({
      name: team.name
    });

    const loadedPokemon = team.pokemon_ids.map(
      (id: number) => ({
        id,
        name: `Pokémon #${id}`
      })
    );

    this.selectedPokemon.set(loadedPokemon);
  }

  /**
   * Handles drag-drop events.
   */

onDrop(event: CdkDragDrop<any[]>): void {
  if (event.previousContainer === event.container) {
    moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
  } else {
    // FIX: Proper way to handle Signals with drag-drop
    const currentList = [...this.selectedPokemon()];
    
    // Check if adding from Pokedex (which is not in this.selectedPokemon)
    if (event.previousContainer.id !== 'teamList') {
       if (currentList.length >= 6) return;
       currentList.push(event.item.data);
    } else {
       transferArrayItem(event.previousContainer.data, currentList, event.previousIndex, event.currentIndex);
    }
    
    this.selectedPokemon.set(currentList);
  }
}
  /**
   * Removes Pokémon from squad.
   */
  removePokemon(index: number): void {

    this.selectedPokemon.update(
      list => list.filter((_, i) => i !== index)
    );
  }

  /**
   * Saves team with optimistic updates.
   */
  saveTeam(): void {

    if (
      this.teamForm.invalid ||
      this.selectedPokemon().length === 0
    ) {
      return;
    }

    const payload = {

      name: this.teamForm.value.name,

      trainer_id: this.currentTrainerId(),

      pokemon_ids: this.selectedPokemon()
        .map(p => Number(p.id)),

      created_at: new Date().toISOString()
    };

    /**
     * Optimistic UI update.
     */
    const tempTeam = {
      id: Date.now(),
      ...payload
    };

    this.store.teams.update(
      current => [...current, tempTeam]
    );

    this.service.createNewTeam(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({

        next: () => {

          this.snackBar.open(
            'Team saved successfully!',
            'Close',
            { duration: 3000 }
          );
        },

        error: () => {

          /**
           * Rollback if API fails.
           */
          this.store.teams.update(
            current =>
              current.filter(
                team => team.id !== tempTeam.id
              )
          );

          this.snackBar.open(
            'Failed to save team',
            'Retry',
            { duration: 3000 }
          );
        }
      });
  }

  /**
   * Filters Pokédex list.
   */
  applyFilter(event: Event): void {

    const value = (
      event.target as HTMLInputElement
    ).value.toLowerCase();

    this.allPokemon =
      this.originalPokemonList.filter(
        p =>
          p.name
            .toLowerCase()
            .includes(value)
      );
  }

  /**
   * Generates type distribution.
   */
  private getDistribution(
    squad: any[]
  ): Record<string, number> {

    return squad.reduce((acc, p) => {

      const type =
        p.types?.[0]?.name || 'Unknown';

      acc[type] = (acc[type] || 0) + 1;

      return acc;

    }, {} as Record<string, number>);
  }

  showTypeWarning(): boolean {

    return (
      this.selectedPokemon().length > 0 &&
      this.selectedPokemon().length < 3
    );
  }
}