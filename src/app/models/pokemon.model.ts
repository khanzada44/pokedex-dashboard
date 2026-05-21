export interface Pokemon {
  id: number;
  name: string;
  image?: string;

  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;

  types: string[];
  total: number;
}