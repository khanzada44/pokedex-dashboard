import {
  Component,
  ViewChild,
  AfterViewInit,
  OnInit,
  ChangeDetectionStrategy,
  signal,
  ChangeDetectorRef,
  inject,
  ElementRef,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../shared/material/material-module';
import { Sidebar } from '../../layout/sidebar/sidebar';
import { MatSort } from '@angular/material/sort';
import { SelectionModel } from '@angular/cdk/collections';
import { PokemonStore } from '../../state/pokemon.store';
import { Observable } from 'rxjs';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import Chart from 'chart.js/auto';
import { TrainerDashboardStore } from '../../state/trainer.store';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-pokedex',
  standalone: true,
  imports: [CommonModule, MaterialModule, Sidebar],
  templateUrl: './pokedex.html',
  styleUrls: ['./pokedex.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Pokedex implements OnInit, AfterViewInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild('radarChartCanvas') radarChartCanvas!: ElementRef<HTMLCanvasElement>;

  private sanitizer = inject(DomSanitizer);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);
  public pokemonStore = inject(PokemonStore);
  private trainerStore = inject(TrainerDashboardStore);

  /** Signal for details panel open/close state */
  isDetailsPanelOpen = signal<boolean>(false);

  pageSize = 10;
  pageSizeOptions = [10, 50, 100];
  displayedColumns: string[] = [
    'select',
    'image',
    'name',
    'types',
    'hp',
    'attack',
    'defense',
    'specialAttack',
    'specialDefense',
    'speed',
    'total',
    'actions',
  ];

  vm$: Observable<any> = this.pokemonStore.vm$;
  selection = new SelectionModel<any>(true, []);
  chartInstance: Chart | null = null;

  /**
   * Static map of Pokémon ID → YouTube video ID.
   * Task 7: fallback to official artwork when ID not present.
   */
  private videoMap: Record<number, string> = {
    1: 'm0D_SscSfs8',
    4: '870Xv5U_mCE',
    7: 'U6gBv828y40',
    13: 'kbyL7b3pCQQ',
  };

  /** @inheritdoc */
  ngOnInit(): void {
    this.pokemonStore.setPage(0);
  }

  /**
   * After view init: wire up sort changes and subscribe to
   * selectedPokemonDetails$ to reactively re-render radar chart
   * whenever a new Pokémon is selected.
   */
  ngAfterViewInit(): void {
    if (this.sort) {
      this.sort.sortChange
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((sort) => {
          this.pokemonStore.setSort(sort.active, sort.direction);
        });
    }

    // Reactively update radar chart when pokemon details change
    this.pokemonStore.selectedPokemonDetails$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((pokemon) => {
        if (pokemon?.pokemon_v2_pokemonstats) {
          // Small delay ensures @if block has rendered the canvas in DOM
          setTimeout(() => {
            this.initRadarChart(pokemon.pokemon_v2_pokemonstats);
            this.cdr.markForCheck();
          }, 50);
        }
      });
  }

  /**
   * Sanitizes and returns a YouTube embed URL for the given Pokémon ID.
   * Returns null if no video is mapped — template shows fallback artwork.
   *
   * @param pokemonId - Pokémon dex ID
   * @returns SafeResourceUrl or null
   */
  getVideoUrl(pokemonId: number): SafeResourceUrl | null {
    const videoId = this.videoMap[pokemonId];
    if (!videoId) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`,
    );
  }

  /**
   * Plays the official Pokémon cry audio via HTML5 Audio API.
   * Source: PokeAPI cries repository.
   *
   * @param pokemonId - Pokémon dex ID
   */
  playPokemonCry(pokemonId: number): void {
    const audio = new Audio(
      `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${pokemonId}.ogg`,
    );
    audio.volume = 0.4;
    audio.play().catch((err) => console.warn('Audio play blocked:', err));
  }

  /**
   * Initializes or re-renders the Chart.js radar chart with the given stats array.
   * Destroys any existing chart instance before creating a new one to prevent memory leaks.
   * Animates on every update (duration: 800ms, easing: easeOutQuart).
   *
   * @param statsArray - Array of pokemon_v2_pokemonstat objects
   */
  initRadarChart(statsArray: any[]): void {
    if (!this.radarChartCanvas) return;

    const statsLabels = ['HP', 'Attack', 'Defense', 'Sp. Atk', 'Sp. Def', 'Speed'];
    const targetKeys = ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'];

    const dataValues = targetKeys.map((key) => {
      const match = statsArray.find((s) => s?.pokemon_v2_stat?.name === key);
      return match?.base_stat ?? 0;
    });

    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    const ctx = this.radarChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    this.chartInstance = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: statsLabels,
        datasets: [
          {
            label: 'Base Stats',
            data: dataValues,
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            borderColor: 'rgba(59, 130, 246, 1)',
            borderWidth: 2,
            pointBackgroundColor: 'rgba(30, 64, 175, 1)',
            pointHoverRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 800, easing: 'easeOutQuart' },
        scales: {
          r: {
            min: 0,
            max: 160,
            ticks: { display: false },
            grid: { color: 'rgba(226, 232, 240, 0.8)' },
          },
        },
        plugins: { legend: { display: false } },
      },
    });
  }

  /**
   * Opens the details side panel for the selected Pokémon row.
   * Triggers store fetch which reactively updates the panel via selectedPokemonDetails$.
   * No setTimeout needed — query now returns height, weight, stats, moves, evolution directly.
   *
   * @param pokemon - Row data from the mat-table
   */
  openDetailsPanel(pokemon: any): void {
    this.pokemonStore.setSelectedPokemonId(pokemon.id);
    this.isDetailsPanelOpen.set(true);
  }

  /**
   * Returns the color class for a stat bar based on its value.
   *
   * @param value - base_stat number
   * @returns CSS class string: 'low' | 'mid' | 'high'
   */
  getStatClass(value: number): string {
    if (value < 50) return 'low';
    if (value < 100) return 'mid';
    return 'high';
  }

  /**
   * Returns the percentage width for a stat progress bar (max 255).
   *
   * @param value - base_stat number
   * @returns percentage as number (0–100)
   */
  getStatPercent(value: number): number {
    return Math.min((value / 255) * 100, 100);
  }

  // ─── Table Handlers ───────────────────────────────────────────────

  /** @param event - DOM input event from search field */
  onSearch(event: any): void {
    this.pokemonStore.setSearch(event.target.value);
  }

  /** @param value - Selected type string from mat-select */
  onTypeFilter(value: string): void {
    this.pokemonStore.setType(value);
  }

  /**
   * Updates the base-stat range filter in the store.
   *
   * @param min - Minimum total base stats
   * @param max - Maximum total base stats
   */
  onRangeSliderChange(min: string | number, max: string | number): void {
    this.pokemonStore.setStatsRange(Number(min), Number(max));
  }

  /**
   * Handles paginator page change events.
   *
   * @param event - MatPaginator PageEvent
   */
  onPageChange(event: PageEvent): void {
    this.pageSize = event.pageSize;
    this.pokemonStore.setPageSize(event.pageSize);
    this.pokemonStore.setPage(event.pageIndex);
    this.selection.clear();
  }

  /**
   * Returns true if all visible rows are selected.
   *
   * @param rows - Current page's row data array
   */
  isAllSelected(rows: any[]): boolean {
    return this.selection.selected.length === rows.length;
  }

  /**
   * Toggles selection for all rows on current page.
   *
   * @param rows - Current page's row data array
   */
  masterToggle(rows: any[]): void {
    this.isAllSelected(rows)
      ? this.selection.clear()
      : rows.forEach((r) => this.selection.select(r));
  }

  /** Resets all active filters and clears row selection. */
  resetFilters(): void {
    this.pokemonStore.reset();
    this.selection.clear();
  }

  /**
   * Finds a specific stat value by stat name from the stats array.
   *
   * @param stats - Array of pokemon_v2_pokemonstat objects
   * @param name - Stat name e.g. 'hp', 'attack', 'special-attack'
   * @returns base_stat number or 0 if not found
   */
  getStat(stats: any[], name: string): number {
    return stats?.find((s) => s?.pokemon_v2_stat?.name === name)?.base_stat ?? 0;
  }

  /**
   * Calculates total base stats by summing all stat values.
   *
   * @param stats - Array of pokemon_v2_pokemonstat objects
   * @returns Sum of all base_stat values
   */
  getTotal(stats: any[]): number {
    return stats?.reduce((sum, s) => sum + (s?.base_stat ?? 0), 0) ?? 0;
  }

  /**
   * Adds all currently selected Pokémon to the active team (team ID 1).
   * Clears selection after operation.
   */
  bulkAddToTeam(): void {
    const selectedIds = this.selection.selected.map((p) => p.id);
    if (selectedIds.length === 0) return;
    this.trainerStore.addPokemonToTeam(1, selectedIds);
    this.selection.clear();
  }
}