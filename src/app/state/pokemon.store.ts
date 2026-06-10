import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { debounceTime, switchMap, map, startWith } from 'rxjs/operators';
import { PokemonService } from '../services/pokemon.service';
import { Pokemon } from '../models/pokemon.model';

@Injectable({
  providedIn: 'root'
})
export class PokemonStore {
  public isDetailsLoading$ = new BehaviorSubject<boolean>(false);
  public selectedPokemonDetails$ = new BehaviorSubject<any>(null);
  
  private readonly _pokemon$ = new BehaviorSubject<Pokemon[]>([]);
  private selectedPokemonIdSubject = new BehaviorSubject<number | null>(null);
  
  private search$ = new BehaviorSubject<string>('');
  private type$ = new BehaviorSubject<string>('');
  private minStats$ = new BehaviorSubject<number>(0);
  private maxStats$ = new BehaviorSubject<number>(800);
  private page$ = new BehaviorSubject<number>(0);
  private sortField$ = new BehaviorSubject<string>('id');
  private sortDir$ = new BehaviorSubject<string>('asc');
  private pageSize$ = new BehaviorSubject<number>(10);
  private detailsCache = new Map<number, any>();

  public selectedPokemonId$ = this.selectedPokemonIdSubject.asObservable();
  public readonly pokemon$ = this._pokemon$.asObservable();

  constructor(private pokemonService: PokemonService) { }

  setPokemons(pokemons: Pokemon[]): void {
    this._pokemon$.next(pokemons);
  }

  prefetchPokemonDetails(id: number): void {
  if (this.detailsCache.has(id)) return;

  this.pokemonService.getPokemonDetails(id).subscribe({
    next: (res) => {
      const details = res?.pokemon_v2_pokemon_by_pk;
      if (details) {
        this.detailsCache.set(id, { ...details });
      }
    },
    error: () => {}
  });
}

private fetchPokemonDetails(id: number): void {
  if (this.detailsCache.has(id)) {
    this.selectedPokemonDetails$.next(this.detailsCache.get(id));
    this.isDetailsLoading$.next(false);
    return;
  }

  this.isDetailsLoading$.next(true);
  this.selectedPokemonDetails$.next(null);

  this.pokemonService.getPokemonDetails(id).subscribe({
    next: (res) => {
      const details = res?.pokemon_v2_pokemon_by_pk;
      if (details) {
        this.detailsCache.set(id, { ...details });
        this.selectedPokemonDetails$.next({ ...details });
      } else {
        this.selectedPokemonDetails$.next(null);
      }
      this.isDetailsLoading$.next(false);
    },
    error: (err) => {
      console.error('Error fetching pokemon details:', err);
      this.selectedPokemonDetails$.next(null);
      this.isDetailsLoading$.next(false);
    }
  });
}

vm$ = combineLatest([
    this.search$,
    this.type$,
    this.minStats$,
    this.maxStats$,
    this.page$,
    this.sortField$,
    this.sortDir$,
    this.pageSize$ 
  ]).pipe(
    debounceTime(300),
    switchMap(([search, type, minStats, maxStats, page, sortField, sortDir, pageSize]) => {
      const limit = pageSize;             
      const offset = page * pageSize;      

      return this.pokemonService.getPokemons(limit, offset, search, type).pipe(
        startWith(null),
        map((res: any) => {
          if (!res) return null;
          const data = res?.pokemon_v2_pokemon || [];
          const serverTotalCount = res?.pokemon_v2_pokemon_aggregate?.aggregate?.count ?? 0;
          if (!res) return null; 
          let filtered = [...data];
          filtered = filtered.filter((p: any) => {
            const totalStat = this.getTotal(p.pokemon_v2_pokemonstats);
            return totalStat >= minStats && totalStat <= maxStats;
          });

          const isAsc = sortDir === 'asc';
          filtered = filtered.sort((a: any, b: any) => {
            switch (sortField) {
              case 'name': return this.compare(a.name, b.name, isAsc);
              case 'id': return this.compare(a.id, b.id, isAsc);
              case 'height': return this.compare(a.height, b.height, isAsc);
              case 'weight': return this.compare(a.weight, b.weight, isAsc);
              default: return 0;
            }
          });

          return {
            pokemons: filtered,
            total: serverTotalCount,
            page,
            pageSize,    
            minStats,
            maxStats
          };
        })
      );
    })
  );
  setSearch(value: string): void { this.search$.next(value); this.page$.next(0); }
  setType(value: string): void { this.type$.next(value); this.page$.next(0); }
  setStatsRange(min: number, max: number): void { this.minStats$.next(min); this.maxStats$.next(max); this.page$.next(0); }
  setPage(value: number): void { this.page$.next(value); }
  setPageSize(size: number): void { this.pageSize$.next(size); }
  setSort(field: string, direction: string): void { this.sortField$.next(field); this.sortDir$.next(direction || 'asc'); }
  
  reset(): void {
    this.search$.next(''); this.type$.next(''); this.minStats$.next(0); this.maxStats$.next(800);
    this.page$.next(0); this.sortField$.next('id'); this.sortDir$.next('asc');
  }

  getTotal(stats: any[]): number {
    if (!stats) return 0;
    return stats.reduce((sum, s) => sum + (s?.base_stat ?? 0), 0);
  }

  compare(a: number | string, b: number | string, isAsc: boolean): number {
    return (a < b ? -1 : 1) * (isAsc ? 1 : -1);
  }

  setSelectedPokemonId(id: number): void {
    this.selectedPokemonIdSubject.next(id);
    this.fetchPokemonDetails(id);
  }
}