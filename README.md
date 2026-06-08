# BAB Beviser

Version 0 af en statisk Progressive Web App til BAB-beviser og chaufførkort.

Appen bruger React, Vite, TypeScript, PDF.js og IndexedDB. Den har ingen login, cloud-lagring, server-upload, cookies, analytics eller tracking. Beviser, billeder, datoer og backupdata gemmes lokalt på brugerens egen enhed.

## Kør lokalt

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Build output ligger i:

```text
dist
```

## Deploy på Cloudflare Pages

Opret et Cloudflare Pages-projekt og brug:

```text
Build command: npm run build
Output directory: dist
```

Projektet er en statisk PWA og kræver ingen serverfunktioner.

## Testscenarier

1. Installer appen på Android: åbn siden i Chrome, tryk på de tre prikker, og vælg Installer app eller Føj til startskærm.
2. Importer en PDF under et BAB-bevis.
3. Kontroller at PDF'en vises inde i appen.
4. Zoom og panorer i dokumentområdet.
5. Indtast Gyldig fra.
6. Vælg gyldighed.
7. Se beregnet udløb.
8. Se bestillingsdato.
9. Opret Google Kalender-aftale og kontroller titel, dato og beskrivelse.
10. Eksporter backup som `bab-beviser-backup-YYYY-MM-DD.json`.
11. Slet et bevis.
12. Importer backupfilen.
13. Kontroller at fil, datoer, gyldighed og status er gendannet.

## Backup

Backup eksporteres som JSON og indeholder dokumenter som base64 data-URL, filtype, filnavn, dokumenttype, gyldighedsdata og nok information til at beregne udløb og bestillingsdato igen.

`.mht` accepteres ikke som backup. Brug appens egen backupfunktion.

## Privatliv

Alle data gemmes lokalt i IndexedDB på enheden. Udvikleren kan ikke se brugerens beviser. Kalenderpåmindelser oprettes via et Google Kalender-link, når brugeren selv trykker på kalenderknappen.
