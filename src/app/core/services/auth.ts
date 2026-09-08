import { Injectable, inject } from '@angular/core';
import { Auth, signInWithEmailAndPassword, signOut, authState, User } from '@angular/fire/auth';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  // Inyectamos el servicio oficial de Firebase Auth
  private auth: Auth = inject(Auth);

  // Observable que emitirá en tiempo real si hay alguien logueado o no
  public user$: Observable<User | null> = authState(this.auth);

  // Método para iniciar sesión
  async login(email: string, password: string) {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  // Método para cerrar sesión
  async logout() {
    return signOut(this.auth);
  }
}
