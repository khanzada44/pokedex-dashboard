export const UPDATE_TEAM_MUTATION =`
  mutation UpdateTeam($id: ID!, $pokemon_ids: [Int!]!) {
    updateTeam(id: $id, pokemon_ids: $pokemon_ids) {
      id
      name
      pokemon_ids
    }
  }
`;