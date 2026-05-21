import { Routes } from '@angular/router';
import { Pokedex } from './pages/pokedex/pokedex';
import { Trainer } from './pages/trainer/trainer';
import { BattleLog } from './pages/battle-log/battle-log';



export const routes: Routes = [
    {
        path: 'pokedex',
        component: Pokedex,
    },
    {
        path: 'trainer',
        component: Trainer,
    },
    {
        path: 'battles-log',
        component: BattleLog,
    }
];
