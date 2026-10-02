// Mueve el PIN del anfitrión del documento público del evento a eventos/{id}/privado/acceso.
// Uso (desde functions/):
//   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\ruta\service-account.json"
//   npm run migrar-pines            -> muestra lo que haría
//   npm run migrar-pines -- --aplicar
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const aplicar = process.argv.includes('--aplicar');

initializeApp({ credential: applicationDefault(), projectId: 'nahoflo-event' });
const db = getFirestore();

const eventos = await db.collection('eventos').get();
let migrados = 0;
let yaPrivados = 0;
let sinPin = 0;

for (const evento of eventos.docs) {
  const pinPublico = evento.get('pinAnfitrion');
  const accesoRef = evento.ref.collection('privado').doc('acceso');
  const acceso = await accesoRef.get();

  if (typeof pinPublico !== 'string' || !pinPublico) {
    if (acceso.exists) yaPrivados++;
    else sinPin++;
    continue;
  }

  const pinFinal = acceso.exists ? acceso.get('pinAnfitrion') : pinPublico;
  console.log(`${aplicar ? 'Migrando' : '[simulación]'} ${evento.id} (${evento.get('titulo') ?? ''})`);

  if (aplicar) {
    const batch = db.batch();
    if (!acceso.exists) {
      batch.set(accesoRef, { pinAnfitrion: pinPublico, pinVersion: 1, actualizadoEn: FieldValue.serverTimestamp() });
    }
    batch.update(evento.ref, { pinAnfitrion: FieldValue.delete(), pinLongitud: String(pinFinal).length });
    await batch.commit();
  }
  migrados++;
}

console.log(`\nEventos: ${eventos.size}`);
console.log(`${aplicar ? 'Migrados' : 'Por migrar'}: ${migrados}`);
console.log(`Ya protegidos: ${yaPrivados}`);
console.log(`Sin PIN: ${sinPin}`);
if (!aplicar && migrados) console.log('\nVuelve a correrlo con -- --aplicar para guardar los cambios.');
