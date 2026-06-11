import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'pokedex',
    pathMatch: 'full',
  },

  {
    path: 'pokedex',
    loadComponent: () =>
      import('./pages/pokedex/pokedex').then(m => m.Pokedex),
    title: 'Pokedex',
  },

  {
    path: 'trainer',
    loadComponent: () =>
      import('./pages/trainer/trainer').then(m => m.Trainer),
    title: 'Trainer',
  },

  {
    path: 'battles-log',
    loadComponent: () =>
      import('./pages/battle-log/battle-log').then(m => m.BattleLog),
    title: 'Battle Log',
  },

  {
    path: 'battles',
    loadComponent: () =>
      import('./pages/battle/battle').then(m => m.BattleComponent),
    title: 'Battles',
  },

  {
    path: 'team-builder',
    loadComponent: () =>
      import('./pages/team-builder/team-builder').then(m => m.TeamBuilder),
    title: 'Team Builder',
  },

  {
    path: '**',
    redirectTo: 'pokedex',
  },
];