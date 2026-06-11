import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, OnInit, signal } from '@angular/core';
import { AbstractControl, AsyncValidatorFn, FormArray, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
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
  imports: [CommonModule, ReactiveFormsModule, MaterialModule, DragDropModule, Sidebar, ScrollingModule],
  templateUrl: './team-builder.html',
  styleUrl: './team-builder.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamBuilder implements OnInit {

  allPokemon: any[] = [];
  originalPokemonList: any[] = [];
  pokedexList: any[] = [];

  loading = signal(false);
  activeTab = signal(0);
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
      totalPower: squad.reduce((acc, p) => acc + (p.base_stat || 0), 0),
      typeDistribution: this.getDistribution(squad)
    };
  });

  constructor() {
    effect(() => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('trainerId', this.currentTrainerId().toString());
      }
    });

    effect(() => {
      console.log('Viewed Pokémon:', this.selectedPokemon().map(p => p.name));
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
          this.pokedexList = [...data];
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.snackBar.open('Failed to load Pokémon', 'Close', { duration: 3000 });
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
            team => team.name.toLowerCase() === name.toLowerCase()
          );
          return exists ? { teamExists: true } : null;
        })
      );
    };
  }

  calculateTotalPower(): number {
    return this.selectedPokemon().reduce((acc, p) => acc + (p.base_stat || 0), 0);
  }

  calculateCoverage(): string[] {
    const types = this.selectedPokemon().map(p => p.type || 'Normal');
    return Array.from(new Set(types));
  }

  loadTeam(team: any): void {
    this.teamForm.patchValue({ name: team.name });
    const loadedPokemon = team.pokemon_ids.map((id: number) => ({
      id,
      name: `Pokémon #${id}`
    }));
    this.selectedPokemon.set(loadedPokemon);
  }

  onDrop(event: CdkDragDrop<any[]>): void {
    console.log('Drop event:', event);
    
    if (event.previousContainer === event.container) {
      // Reordering within the team
      const currentList = [...this.selectedPokemon()];
      moveItemInArray(currentList, event.previousIndex, event.currentIndex);
      this.selectedPokemon.set(currentList);
      this.snackBar.open('Team reordered!', 'Close', { duration: 1000 });
    } else {
      // Adding from Pokedex
      const currentTeam = [...this.selectedPokemon()];
      
      if (currentTeam.length >= 6) {
        this.snackBar.open('Team is full! Maximum 6 Pokémon allowed.', 'Close', { duration: 3000 });
        return;
      }
      
      const droppedPokemon = event.item.data;
      const alreadyExists = currentTeam.some(p => p.id === droppedPokemon.id);
      
      if (alreadyExists) {
        this.snackBar.open(`${droppedPokemon.name} is already in your team!`, 'Close', { duration: 3000 });
        return;
      }
      
      currentTeam.splice(event.currentIndex, 0, droppedPokemon);
      this.selectedPokemon.set(currentTeam);
      this.snackBar.open(`${droppedPokemon.name} added to team!`, 'Close', { duration: 2000 });
    }
  }

  removePokemon(index: number): void {
    const removed = this.selectedPokemon()[index];
    this.selectedPokemon.update(list => list.filter((_, i) => i !== index));
    this.snackBar.open(`${removed.name} removed from team!`, 'Close', { duration: 2000 });
  }

  saveTeam(): void {
    if (this.teamForm.valid && this.selectedPokemon().length > 0) {
      console.log('Saving team:', {
        ...this.teamForm.value,
        pokemon: this.selectedPokemon()
      });
      this.snackBar.open('Team saved successfully!', 'Close', { duration: 3000 });
    } else {
      this.snackBar.open('Please fill team name and add at least one Pokémon', 'Close', { duration: 3000 });
    }
  }

  applyFilter(event: Event): void {
    const value = (event.target as HTMLInputElement).value.toLowerCase();
    this.pokedexList = value
      ? this.originalPokemonList.filter(p => p.name.toLowerCase().includes(value))
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
    return this.selectedPokemon().length > 0 && this.selectedPokemon().length < 3;
  }

  getEmptySlotsArray(): number[] {
    const emptyCount = Math.max(0, 6 - this.selectedPokemon().length);
    return Array(emptyCount).fill(0).map((_, i) => i);
  }
}