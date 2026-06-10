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
  private prefetchedIds = new Set<number>(); 

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


  private videoMap: Record<number, string> = {
    1: 'm0D_SscSfs8',
    4: '870Xv5U_mCE',
    7: 'U6gBv828y40',
    13: 'kbyL7b3pCQQ',
  };

  ngOnInit(): void {
    this.pokemonStore.setPage(0);
  }

  ngAfterViewInit(): void {
    if (this.sort) {
      this.sort.sortChange
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((sort) => {
          this.pokemonStore.setSort(sort.active, sort.direction);
        });
    }

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


  getVideoUrl(pokemonId: number): SafeResourceUrl | null {
    const videoId = this.videoMap[pokemonId];
    if (!videoId) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`,
    );
  }


  playPokemonCry(pokemonId: number): void {
    const audio = new Audio(
      `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${pokemonId}.ogg`,
    );
    audio.volume = 0.4;
    audio.play().catch((err) => console.warn('Audio play blocked:', err));
  }


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


  openDetailsPanel(pokemon: any): void {
    this.pokemonStore.setSelectedPokemonId(pokemon.id);
    this.isDetailsPanelOpen.set(true);
  }


  getStatClass(value: number): string {
    if (value < 50) return 'low';
    if (value < 100) return 'mid';
    return 'high';
  }


  getStatPercent(value: number): number {
    return Math.min((value / 255) * 100, 100);
  }


  onSearch(event: any): void {
    this.pokemonStore.setSearch(event.target.value);
  }


  onTypeFilter(value: string): void {
    this.pokemonStore.setType(value);
  }

  onRangeSliderChange(min: string | number, max: string | number): void {
    this.pokemonStore.setStatsRange(Number(min), Number(max));
  }


  onPageChange(event: PageEvent): void {
    this.pageSize = event.pageSize;
    this.pokemonStore.setPageSize(event.pageSize);
    this.pokemonStore.setPage(event.pageIndex);
    this.selection.clear();
  }


  isAllSelected(rows: any[]): boolean {
    return this.selection.selected.length === rows.length;
  }


  masterToggle(rows: any[]): void {
    this.isAllSelected(rows)
      ? this.selection.clear()
      : rows.forEach((r) => this.selection.select(r));
  }

  resetFilters(): void {
    this.pokemonStore.reset();
    this.selection.clear();
  }
  prefetchPokemon(id: number): void {
  if (this.prefetchedIds.has(id)) return;
  this.prefetchedIds.add(id);
  this.pokemonStore.prefetchPokemonDetails(id); // silent cache only
}


  getStat(stats: any[], name: string): number {
    return stats?.find((s) => s?.pokemon_v2_stat?.name === name)?.base_stat ?? 0;
  }


  getTotal(stats: any[]): number {
    return stats?.reduce((sum, s) => sum + (s?.base_stat ?? 0), 0) ?? 0;
  }


  bulkAddToTeam(): void {
    const selectedIds = this.selection.selected.map((p) => p.id);
    if (selectedIds.length === 0) return;
    this.trainerStore.addPokemonToTeam(1, selectedIds);
    this.selection.clear();
  }
  
}