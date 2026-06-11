// app.config.ts
import { ApplicationConfig, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, HttpClient } from '@angular/common/http';
import { provideApollo } from 'apollo-angular';
import { InMemoryCache } from '@apollo/client/core';
import { HttpLink } from 'apollo-angular/http';
import { routes } from './app.routes';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withFetch()),

    provideApollo(() => {
    const http = inject(HttpClient);
    const httpLink = new HttpLink(http);

      const pokeApi = httpLink.create({
        uri: environment.betaApiUrl,
      });

      const localApi = httpLink.create({
        uri: environment.apiUrl,
      });

      return {
        link: pokeApi,
        cache: new InMemoryCache(),
        defaultOptions: {
          watchQuery: { fetchPolicy: 'cache-and-network' },
          query: { fetchPolicy: 'network-only' },
        },
      };
    }),
  ],
};