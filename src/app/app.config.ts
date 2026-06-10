import { ApplicationConfig, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, HttpClient } from '@angular/common/http';

import { provideApollo } from 'apollo-angular';
import { InMemoryCache } from '@apollo/client/core';
import { HttpLink } from 'apollo-angular/http';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { environment } from '../environments/environment';

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
        uri: environment.betaApiUrl,
      });

      // Local GraphQL server (Mutations + Subscriptions)
      const localApi = httpLink.create({
        uri: environment.apiUrl,
      });

      return {
        // Default link (PokeAPI)
        link: pokeApi,
        cache: new InMemoryCache(),
      };
    }),
  ],
};