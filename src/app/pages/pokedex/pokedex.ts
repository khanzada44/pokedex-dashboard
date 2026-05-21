import { Component, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../shared/material/material-module';
import { Sidebar } from '../../layout/sidebar/sidebar';
import { MatSort } from '@angular/material/sort';
import { PageEvent } from '@angular/material/paginator';
import { PokemonStore } from '../../state/pokemon.store';

@Component({
  selector: 'app-pokedex',
  standalone: true,
  imports: [CommonModule, MaterialModule, Sidebar],
  templateUrl: './pokedex.html',
  styleUrls: ['./pokedex.scss']
})
export class Pokedex implements AfterViewInit {

  pageSize = 10;
  pageSizeOptions = [10, 20, 50];

  displayedColumns: string[] = [
    'image','name','types','hp','attack','defense','total'
  ];

  get vm$() {
    return this.pokemonStore.vm$;
  }

  @ViewChild(MatSort) sort!: MatSort;

  constructor(private pokemonStore: PokemonStore) {}

  ngAfterViewInit() {
    if (this.sort) {
      this.sort.sortChange.subscribe(sort => {
        this.pokemonStore.setSort(sort.active, sort.direction);
      });
    }
  }

  onSearch(event: any) {
    this.pokemonStore.setSearch(event.target.value);
  }

  onTypeFilter(value: string) {
    this.pokemonStore.setType(value);
  }

  onPageChange(event: PageEvent) {
  this.pageSize = event.pageSize;
  this.pokemonStore.setPage(event.pageIndex);
  }

  resetFilters() {
    this.pokemonStore.reset();
  }

  getStat(stats: any[], statName: string): number {
    if (!stats) return 0;

    const stat = stats.find(
      s => s?.pokemon_v2_stat?.name === statName
    );

    return stat?.base_stat ?? 0;
  }

  getTotal(stats: any[]): number {
    if (!stats) return 0;

    return stats.reduce(
      (sum, s) => sum + (s?.base_stat ?? 0),
      0
    );
  }
}