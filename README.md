# XOK WebApp

Aplicació React/Vite amb joc local, rival CPU i sales en línia amb Firebase Authentication anònim i Firestore.

## Executar i verificar

Requereix Node.js 18 o posterior i npm.

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

El directori de producció és `dist/`.

## Organització

- `src/App.jsx`: interfície, traduccions i coordinació de partides.
- `src/game.js`: geometria, cadenes, captures legals i selecció de taurons de la CPU.
- `src/rooms.js`: operacions transaccionals de creació, reserva de plaça, jugada i reinici.
- `test/`: regressions de les regles i de les operacions simultànies sobre sales. Les proves de sales utilitzen un doble amb reintents optimistes; no contacten amb Firebase.

## Correccions de v2.25

- Cada tauró ha de capturar almenys un peix enemic. Les regles mostrades en català, castellà i anglès també ho indiquen.
- En igualtat de longitud de cadena, guanya qui hi té més taurons.
- La CPU pot utilitzar un tauró gran per capturar un o dos peixos; la puntuació estratègica no elimina jugades legals.
- Sortir, començar i reiniciar neteja les col·locacions pendents.
- Les sales guarden `whiteId`, `blackId` i `revision`. Una transacció reserva la plaça negra; les jugades rebutgen un torn incorrecte o una versió antiga. El blanc espera que s’hi incorpori el negre.
- Les sales anteriors, sense identitats, s’han de recrear. No es pot determinar amb seguretat qui n’era el propietari.

## Regles de Firestore

`firestore.rules` conté la proposta de regles per a les sales de XOK. **Desar aquest fitxer no actualitza les regles del projecte Firebase.** Cal revisar-les i provar-les amb l’emulador abans de publicar-les al projecte `xok-webapp`, preservant les regles que necessitin altres col·leccions.

Substitueix les regles permissives que cobreixin les sales: afegir aquestes restriccions al costat d’un `allow read, write: if true` més general no les protegeix, perquè les autoritzacions coincidents es combinen amb OR.

Aquestes regles protegeixen identitats, ocupació, torns i revisions. El taulell encara es desa com una cadena JSON i la legalitat completa de cada moviment es valida al client. Per impedir trampes d’un client modificat caldria validar el motor del joc en un servei de confiança.

Les proves locals no han publicat regles ni modificat partides del projecte Firebase.
