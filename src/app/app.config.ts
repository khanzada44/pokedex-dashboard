import { ApplicationConfig, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, HttpClient } from '@angular/common/http';

import { provideApollo } from 'apollo-angular';
import { InMemoryCache } from '@apollo/client/core';
import { HttpLink } from 'apollo-angular/http';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withFetch()),
    provideClientHydration(withEventReplay()),

    provideApollo(() => {
      const http = inject(HttpClient);
      const httpLink = new HttpLink(http);

      // PokeAPI (Queries)
      const pokeApi = httpLink.create({
        uri: 'https://beta.pokeapi.co/graphql/v1beta',
      });

      // Local GraphQL server (Mutations + Subscriptions)
      const localApi = httpLink.create({
        uri: 'http://localhost:4000/graphql',
      });

      return {
        // Default link (PokeAPI)
        link: pokeApi,
        cache: new InMemoryCache(),
      };
    }),
  ],
};