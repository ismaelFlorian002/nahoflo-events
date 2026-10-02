import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

// PrimeNG Global Services & Theme Config (v22)
import { ConfirmationService, MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { NahoFloPreset } from './core/config/primeng-theme';

// Firebase
import { getApp, initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { getStorage, provideStorage } from '@angular/fire/storage';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFunctions, provideFunctions } from '@angular/fire/functions';
import { initializeAppCheck, provideAppCheck, ReCaptchaEnterpriseProvider } from '@angular/fire/app-check';
import { environment } from '../environments/environment';

// En localhost App Check usa un token de depuración que se registra en la consola de Firebase.
if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
  (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: NahoFloPreset,
        options: {
          darkModeSelector: 'none',
          // Las utilidades y los estilos de la aplicación prevalecen sobre el tema.
          cssLayer: { name: 'primeng', order: 'app-base, primeng' },
        },
      },
      ripple: true,
    }),
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    ...(environment.appCheckSiteKey
      ? [
          provideAppCheck(() =>
            initializeAppCheck(getApp(), {
              provider: new ReCaptchaEnterpriseProvider(environment.appCheckSiteKey),
              isTokenAutoRefreshEnabled: true,
            }),
          ),
        ]
      : []),
    provideFirestore(() => getFirestore()),
    provideStorage(() => getStorage()),
    provideAuth(() => getAuth()),
    provideFunctions(() => getFunctions(getApp(), environment.functionsRegion)),
    ConfirmationService,
    MessageService,
  ],
};
