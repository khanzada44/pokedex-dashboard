import { ChangeDetectionStrategy, Component,DestroyRef,computed,effect, inject,OnInit,signal} from '@angular/core';
import { AbstractControl, AsyncValidatorFn, FormArray, FormBuilder, ReactiveFormsModule, ValidationErrors,Validators} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule,moveItemInArray} from '@angular/cdk/drag-drop';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { debounceTime, delay, map, Observable, of, retry } from 'rxjs';
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
  imports: [CommonModule, ReactiveFormsModule, MaterialModule, DragDropModule,Sidebar,ScrollingModule
  ],
  templateUrl: './team-builder.html',
  styleUrl: './team-builder.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamBuilder implements OnInit {

  allPokemon: any[] = [];
  originalPokemonList: any[] = [];

  loading = signal(false);
  activeTab = signal(0); // FIX: number for mat-tab-group
  sidebarCollapsed = signal(false);
  currentTrainerId = signal(1);

  private snackBar = inject(MatSnackBar);
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

  public store = inject(TrainerDashboardStore);
  private service = inject(TrainerService);
  private pokemonService = inject(PokemonService);

  selectedPokemon = this.store.selectedPokemon;

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

    effect(() => {
      if (typeof window !== 'undefined') {
        localStorage.setItem(
          'trainerId',
          this.currentTrainerId().toString()
        );
      }
    });

    effect(() => {
      console.log(
        'Viewed Pokémon:',
        this.selectedPokemon().map(p => p.name)
      );
    });
  }

  ngOnInit(): void {
    this.fetchTeams();
    this.fetchPokemon();
  }

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

  fetchPokemon(): void {
    console.log('hello');
    
    this.loading.set(true);

    this.pokemonService.fetchAllPokemon()
      .pipe(
        retry({ count: 3, delay: 1000 }),
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

  get pokemonConfigs(): FormArray {
    return this.teamForm.get('pokemonConfigs') as FormArray;
  }

  uniqueTeamValidator(): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      return of(control.value).pipe(
        debounceTime(300),
        delay(500),
        map((name: string) => {
          const exists = (this.store.allTeams() || []).some(
            team =>
              team.name.toLowerCase() === name.toLowerCase()
          );

          return exists ? { teamExists: true } : null;
        })
      );
    };
  }

  calculateTotalPower(): number {
    return this.selectedPokemon()
      .reduce((acc, p) => acc + (p.base_stat || 0), 0);
  }

  calculateCoverage(): string[] {
    const types = this.selectedPokemon().map(
      p => p.type || 'Normal'
    );

    return Array.from(new Set(types));
  }

  loadTeam(team: any): void {
    this.teamForm.patchValue({
      name: team.name
    });

    const loadedPokemon = team.pokemon_ids.map((id: number) => ({
      id,
      name: `Pokémon #${id}`
    }));

    this.selectedPokemon.set(loadedPokemon);
  }

  onDrop(event: CdkDragDrop<any[]>): void {
    const currentList = [...this.selectedPokemon()];

    if (event.previousContainer === event.container) {
      moveItemInArray(
        currentList,
        event.previousIndex,
        event.currentIndex
      );
    } else {
      if (currentList.length >= 6) return;

      currentList.splice(event.currentIndex, 0, event.item.data);
    }

    this.selectedPokemon.set(currentList);
  }

  removePokemon(index: number): void {
    this.selectedPokemon.update(
      list => list.filter((_, i) => i !== index)
    );
  }

  saveTeam(): void {
    console.log('save team clicked');
  }

  applyFilter(event: Event): void {
    const value = (event.target as HTMLInputElement)
      .value
      .toLowerCase();

    this.allPokemon = value
      ? this.originalPokemonList.filter(p =>
          p.name.toLowerCase().includes(value)
        )
      : [...this.originalPokemonList];
  }

  private getDistribution(squad: any[]): Record<string, number> {
    return squad.reduce((acc, p) => {
      const type = p.types?.[0]?.name || 'Unknown';
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

  noReturnPredicate(): boolean {
    return false;
  }
}