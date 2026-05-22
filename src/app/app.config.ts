import { ApplicationConfig, provideBrowserGlobalErrorListeners, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, HttpClient } from '@angular/common/http'; // withFetch add kiya

import { provideApollo } from 'apollo-angular';
import { InMemoryCache } from '@apollo/client/core';
import { HttpLink } from 'apollo-angular/http';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    provideHttpClient(withFetch()), // Yahan withFetch() enable kiya
    provideApollo(() => {
      const http = inject(HttpClient);
      const httpLink = new HttpLink(http);

      return {
        // PokéAPI aur Local Server dono ke liye setup (agar zaroorat ho)
        // Abhi ke liye default PokéAPI link:
        link: httpLink.create({
          uri: 'https://beta.pokeapi.co/graphql/v1beta',
        }),
        cache: new InMemoryCache(),
      };
    }),
  ],
};