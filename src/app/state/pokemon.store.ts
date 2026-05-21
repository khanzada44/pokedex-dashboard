import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { debounceTime, switchMap, map } from 'rxjs/operators';
import { PokemonService } from '../graphql/services/pokemon.service';

@Injectable({
  providedIn: 'root'
})
export class PokemonStore {

  private search$ = new BehaviorSubject<string>('');
  private type$ = new BehaviorSubject<string>('');
  private minStats$ = new BehaviorSubject<number>(0);
  private page$ = new BehaviorSubject<number>(0);

  private sortField$ = new BehaviorSubject<string>('id');
  private sortDir$ = new BehaviorSubject<string>('asc');

  private pageSize = 10;

  constructor(private pokemonService: PokemonService) {}

  vm$ = combineLatest([
    this.search$,
    this.type$,
    this.minStats$,
    this.page$,
    this.sortField$,
    this.sortDir$
  ]).pipe(

    debounceTime(300),

    switchMap(([search, type, minStats, page, sortField, sortDir]) => {

      const limit = this.pageSize;
      const offset = page * this.pageSize;

      return this.pokemonService.getPokemon(
        limit,
        offset,
        search,
        type
      ).pipe(

       map((res: any) => {

  // =========================
  // SAFE DATA EXTRACTION
  // =========================
  const data = res?.data?.pokemon_v2_pokemon || [];
  const totalCount =
    res?.data?.pokemon_v2_pokemon_aggregate?.aggregate?.count || 0;

  let filtered = [...data];

  // =========================
  // MIN STATS FILTER
  // =========================
  if (minStats > 0) {
    filtered = filtered.filter((p: any) =>
      this.getTotal(p.pokemon_v2_pokemonstats) >= minStats
    );
  }

  // =========================
  // SORTING
  // =========================
  const isAsc = sortDir === 'asc';

  filtered = filtered.sort((a: any, b: any) => {

    switch (sortField) {

      case 'name':
        return this.compare(a.name, b.name, isAsc);

      case 'id':
        return this.compare(a.id, b.id, isAsc);

      case 'height':
        return this.compare(a.height, b.height, isAsc);

      case 'weight':
        return this.compare(a.weight, b.weight, isAsc);

      default:
        return 0;
    }
  });

  return {
    pokemons: filtered,
    total: totalCount
  };
})
      );
    })
  );


  setSearch(value: string) {
    this.search$.next(value);
    this.page$.next(0);
  }

  setType(value: string) {
    this.type$.next(value);
    this.page$.next(0);
  }

  setMinStats(value: number) {
    this.minStats$.next(value);
    this.page$.next(0);
  }

  setPage(value: number) {
    this.page$.next(value);
  }

  setSort(field: string, direction: string) {
    this.sortField$.next(field);
    this.sortDir$.next(direction || 'asc');
  }

  reset() {
    this.search$.next('');
    this.type$.next('');
    this.minStats$.next(0);
    this.page$.next(0);
    this.sortField$.next('id');
    this.sortDir$.next('asc');
  }


  getTotal(stats: any[]): number {
    return stats.reduce((sum, s) => sum + s.base_stat, 0);
  }

  compare(a: number | string, b: number | string, isAsc: boolean) {
    return (a < b ? -1 : 1) * (isAsc ? 1 : -1);
  }
}