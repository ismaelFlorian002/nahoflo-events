import { createHash, timingSafeEqual } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore, type DocumentReference } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/https';
import { setGlobalOptions } from 'firebase-functions/options';

initializeApp();
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

const db = getFirestore();

interface Limite {
  tipo: 'uid' | 'ip' | 'evento';
  maxFallos: number;
  ventanaMin: number;
  bloqueoMin: number;
}

const LIMITES: Limite[] = [
  { tipo: 'uid', maxFallos: 5, ventanaMin: 15, bloqueoMin: 15 },
  { tipo: 'ip', maxFallos: 10, ventanaMin: 60, bloqueoMin: 60 },
  { tipo: 'evento', maxFallos: 100, ventanaMin: 60, bloqueoMin: 60 },
];

interface Contador {
  fallos: number;
  ventanaInicio: Timestamp;
  bloqueadoHasta?: Timestamp | null;
}

type Resultado =
  | { ok: true }
  | { ok: false; motivo: 'incorrecto'; intentosRestantes: number }
  | { ok: false; motivo: 'bloqueado'; minutos: number };

const hash = (valor: string) => createHash('sha256').update(valor).digest('hex').slice(0, 32);

function pinsIguales(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

function ipCliente(headers: Record<string, string | string[] | undefined>, ipDirecta?: string): string {
  const reenviada = headers['x-forwarded-for'];
  const primera = (Array.isArray(reenviada) ? reenviada[0] : reenviada)?.split(',')[0]?.trim();
  return primera || ipDirecta || 'desconocida';
}

/**
 * Verifica el PIN del anfitrión contra eventos/{id}/privado/acceso y, si es correcto,
 * registra eventos/{id}/anfitriones/{uid}. Las reglas de Firestore solo permiten las
 * escrituras del portal a los uid registrados con la pinVersion vigente.
 */
export const verificarPinAnfitrion = onCall({ enforceAppCheck: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sesión requerida.');

  const { eventoId, pin } = (request.data ?? {}) as { eventoId?: unknown; pin?: unknown };
  if (typeof eventoId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(eventoId)) {
    throw new HttpsError('invalid-argument', 'Evento inválido.');
  }
  if (typeof pin !== 'string' || !/^\d{4,6}$/.test(pin)) {
    throw new HttpsError('invalid-argument', 'PIN inválido.');
  }

  const ip = ipCliente(request.rawRequest.headers, request.rawRequest.ip);
  const eventoRef = db.doc(`eventos/${eventoId}`);
  const accesoRef = db.doc(`eventos/${eventoId}/privado/acceso`);
  const anfitrionRef = db.doc(`eventos/${eventoId}/anfitriones/${uid}`);
  const contadores: { limite: Limite; ref: DocumentReference }[] = LIMITES.map((limite) => ({
    limite,
    ref: db.doc(
      `pinIntentos/${eventoId}__${limite.tipo}${
        limite.tipo === 'uid' ? `__${uid}` : limite.tipo === 'ip' ? `__${hash(ip)}` : ''
      }`,
    ),
  }));

  const resultado = await db.runTransaction<Resultado>(async (tx) => {
    const ahora = Timestamp.now();
    const [eventoSnap, accesoSnap, ...contadorSnaps] = await tx.getAll(
      eventoRef,
      accesoRef,
      ...contadores.map((c) => c.ref),
    );

    if (!eventoSnap.exists || eventoSnap.get('estaActivo') !== true) {
      throw new HttpsError('not-found', 'El evento no está disponible.');
    }

    const bloqueos = contadorSnaps
      .map((snap) => (snap.data() as Contador | undefined)?.bloqueadoHasta)
      .filter((t): t is Timestamp => !!t && t.toMillis() > ahora.toMillis());
    if (bloqueos.length) {
      const hasta = Math.max(...bloqueos.map((t) => t.toMillis()));
      return { ok: false, motivo: 'bloqueado', minutos: Math.ceil((hasta - ahora.toMillis()) / 60000) };
    }

    // Eventos anteriores a /privado/acceso: se migra el PIN público en el primer intento.
    let pinGuardado = accesoSnap.get('pinAnfitrion') as string | undefined;
    let pinVersion = (accesoSnap.get('pinVersion') as number | undefined) ?? 1;
    if (!accesoSnap.exists) {
      const pinPublico = eventoSnap.get('pinAnfitrion');
      if (typeof pinPublico !== 'string' || !pinPublico) {
        throw new HttpsError('failed-precondition', 'El evento no tiene PIN configurado.');
      }
      pinGuardado = pinPublico;
      pinVersion = 1;
      tx.set(accesoRef, { pinAnfitrion: pinPublico, pinVersion, actualizadoEn: FieldValue.serverTimestamp() });
      tx.update(eventoRef, { pinAnfitrion: FieldValue.delete(), pinLongitud: pinPublico.length });
    }

    if (pinGuardado && pinsIguales(pin, pinGuardado)) {
      tx.set(anfitrionRef, { pinVersion, creadoEn: FieldValue.serverTimestamp() });
      contadores
        .filter((c) => c.limite.tipo !== 'evento')
        .forEach((c) => tx.delete(c.ref));
      return { ok: true };
    }

    let intentosRestantes = Infinity;
    contadores.forEach(({ limite, ref }, i) => {
      const previo = contadorSnaps[i].data() as Contador | undefined;
      const ventanaVencida =
        !previo || ahora.toMillis() - previo.ventanaInicio.toMillis() > limite.ventanaMin * 60000;
      const fallos = ventanaVencida ? 1 : previo.fallos + 1;
      const bloquear = fallos >= limite.maxFallos;
      tx.set(ref, {
        fallos: bloquear ? 0 : fallos,
        ventanaInicio: ventanaVencida || bloquear ? ahora : previo.ventanaInicio,
        bloqueadoHasta: bloquear ? Timestamp.fromMillis(ahora.toMillis() + limite.bloqueoMin * 60000) : null,
      });
      intentosRestantes = Math.min(intentosRestantes, bloquear ? 0 : limite.maxFallos - fallos);
    });
    return { ok: false, motivo: 'incorrecto', intentosRestantes };
  });

  if (resultado.ok) return { ok: true };
  if (resultado.motivo === 'bloqueado') {
    throw new HttpsError('resource-exhausted', 'Demasiados intentos.', { minutos: resultado.minutos });
  }
  throw new HttpsError('permission-denied', 'PIN incorrecto.', {
    intentosRestantes: resultado.intentosRestantes,
  });
});
