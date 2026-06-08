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
  private sanitizer = inject(DomSanitizer);
  private cdr = inject(ChangeDetectorRef);
  public pokemonStore = inject(PokemonStore);
  private trainerStore = inject(TrainerDashboardStore);

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

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild('radarChartCanvas') radarChartCanvas!: ElementRef<HTMLCanvasElement>;

  // Static Video Map as required by Task 7 documentation
  private videoMap: Record<number, string> = {
    1: 'm0D_SscSfs8', // Bulbasaur strategy/anime video ID
    4: '870Xv5U_mCE', // Charmander
    7: 'U6gBv828y40', // Squirtle
    13: 'kbyL7b3pCQQ', // Weedle
  };

  ngOnInit(): void {
    this.pokemonStore.setPage(0);
    this.vm$.subscribe((res) => {
      console.log(res);
    });
  }

  ngAfterViewInit(): void {
    if (this.sort) {
      this.sort.sortChange.subscribe((sort) => {
        this.pokemonStore.setSort(sort.active, sort.direction);
      });
    }
  }

  /**
   * Sanitizes and returns YouTube embedded video resource link.
   * If no video match is allocated, returns null to fall back to layout graphics.
   */
  getVideoUrl(pokemonId: number): SafeResourceUrl | null {
    const videoId = this.videoMap[pokemonId];
    if (!videoId) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`,
    );
  }

  /**
   * Spawns an animated HTML5 custom audio stream rendering a Pokémon cry.
   */
  playPokemonCry(pokemonId: number): void {
    const audio = new Audio(
      `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${pokemonId}.ogg`,
    );
    audio.volume = 0.4;
    audio.play().catch((err) => console.warn('Audio contextual block triggered:', err));
  }

  /**
   * Initializes or updates the responsive Radar Chart context.
   */
  initRadarChart(statsArray: any[]): void {
    if (!this.radarChartCanvas) return;

    // Ordered stats extraction mapping target layout arrays
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
            label: 'Base Attribute Matrix',
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
    // 1. Pehle console me check karein (yeh chal raha hai)
    console.log('Table Row Data:', pokemon.height, pokemon.weight);

    // 2. Store me ID set karein taake abilities fetch hon
    this.pokemonStore.setSelectedPokemonId(pokemon.id);
    this.isDetailsPanelOpen.set(true);

    // 3. FIX: Ek chota sa timeout lagakar API response aane par height/weight merge karein
    setTimeout(() => {
      const activeDetails = this.pokemonStore.selectedPokemonDetails$.getValue();

      if (activeDetails) {
        // Hum details wale object ke andar table row ki height aur weight forcibly merge kar rahe hain
        const updatedDetails = {
          ...activeDetails,
          height: activeDetails.height || pokemon.height,
          weight: activeDetails.weight || pokemon.weight,
        };

        // Store ki BehaviorSubject pipeline ko updated data wapis bhej rahe hain
        this.pokemonStore.selectedPokemonDetails$.next(updatedDetails);

        // Radar chart ko initialize karein agar stats available hon
        if (activeDetails.pokemon_v2_pokemonstats) {
          this.initRadarChart(activeDetails.pokemon_v2_pokemonstats);
        }
      }
      this.cdr.markForCheck();
    }, 350); // 350ms ka safe gap taake API call resolve ho jaye
  }

  // Mandatory Table Shared Handlers
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
  getStat(stats: any[], name: string): number {
    return stats?.find((s) => s?.pokemon_v2_stat?.name === name)?.base_stat ?? 0;
  }
  getTotal(stats: any[]): number {
    return stats?.reduce((sum, s) => sum + (s?.base_stat ?? 0), 0) ?? 0;
  }

  bulkAddToTeam(): void {
    const selectedIds = this.selection.selected.map((p) => p.id);
    if (selectedIds.length === 0) {
      console.log('Koi Pokémon select nahi kiya bhai!');
      return;
    }
    const activeTeamId = 1;
    this.trainerStore.addPokemonToTeam(activeTeamId, selectedIds);
    this.selection.clear();
  }
}
