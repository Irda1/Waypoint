import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findDates, findReference, parseBookingEmail } from './emailImport.ts';

const TODAY = '2026-10-15';

test('dates : formats français et anglais, année devinée', () => {
  assert.deepEqual(findDates('le mardi 8 mai 2027, 08/05/2027, 2027-05-08, May 8, 2027, 8 May 2027', TODAY).map((d) => d.iso), Array(5).fill('2027-05-08'));
  assert.equal(findDates('Arrivée le 1er décembre', TODAY)[0].iso, '2026-12-01');
  assert.equal(findDates('le 3 mars', TODAY)[0].iso, '2027-03-03');          // mars déjà passé : l'an prochain
  assert.equal(findDates('le 10 oct.', TODAY)[0].iso, '2026-10-10');        // moins de 30 jours avant : cette année
});

test('numéro de réservation après son libellé', () => {
  assert.equal(findReference('Référence de réservation : TP4H2K'), 'TP4H2K');
  assert.equal(findReference('Booking reference: K7ZQ2RT'), 'K7ZQ2RT');
  assert.equal(findReference('Confirmation number: 4182.553.019'), '4182.553.019');
  assert.equal(findReference('Code de confirmation HMABC12345'), 'HMABC12345');
  assert.equal(findReference('Votre référence est bien notée'), '');
});

test('TAP aller-retour : deux vols, dates, heures, numéros, lien', () => {
  const mail = `Votre réservation est confirmée
Référence de réservation : TP4H2K

ALLER  —  mardi 8 mai 2027
TP 437  Paris (CDG) 07:10 → Lisbonne (LIS) 08:45

RETOUR  —  samedi 15 mai 2027
TP 438  Lisbonne (LIS) 19:25 → Paris (CDG) 22:55

Gérer ma réservation : https://www.flytap.com/manage?pnr=TP4H2K`;
  const r = parseBookingEmail(mail, TODAY);
  assert.equal(r.length, 2);
  assert.deepEqual(r[0], { kind: 'vol', title: 'Vol Paris → Lisbonne', reference: 'TP4H2K', starts_on: '2027-05-08', start_time: '07:10', url: 'https://www.flytap.com/manage?pnr=TP4H2K', notes: 'TP 437 · arrivée 08:45' });
  assert.equal(r[1].title, 'Vol Lisbonne → Paris');
  assert.equal(r[1].starts_on, '2027-05-15');
  assert.equal(r[1].start_time, '19:25');
});

test('Air France : vol, aéroports nommés', () => {
  const mail = `Air France - Confirmation de votre réservation
Référence de réservation : 8XK2LM
Le 12/06/2027
Vol AF 1234 — Paris Charles de Gaulle (CDG) 10:30 → Rome Fiumicino (FCO) 12:35`;
  const [v] = parseBookingEmail(mail, TODAY);
  assert.equal(v.title, 'Vol Paris Charles de Gaulle → Rome Fiumicino');
  assert.equal(v.starts_on, '2027-06-12');
  assert.equal(v.notes, 'AF 1234 · arrivée 12:35');
});

test('easyJet : horaires sur la ligne suivante', () => {
  const mail = `Your booking is confirmed
Booking reference: K7ZQ2RT
EZY4521  London Gatwick (LGW) to Lisbon (LIS) - Wed 12 Jun 2027
Depart 06:15 · Arrive 09:05`;
  const [v] = parseBookingEmail(mail, TODAY);
  assert.equal(v.kind, 'vol');
  assert.equal(v.title, 'Vol London Gatwick → Lisbon');
  assert.equal(v.starts_on, '2027-06-12');
  assert.equal(v.start_time, '06:15');
  assert.equal(v.reference, 'K7ZQ2RT');
});

test('SNCF : train, gares, numéro du train', () => {
  const mail = `SNCF Connect - Confirmation
Référence de dossier : QXZ7PL
Aller le jeudi 14 novembre 2026
TGV INOUI 6603  Paris Gare de Lyon 07:56 → Lyon Part Dieu 09:52
Voiture 12, place 45`;
  const [t] = parseBookingEmail(mail, TODAY);
  assert.equal(t.kind, 'train');
  assert.equal(t.title, 'Train Paris Gare de Lyon → Lyon Part Dieu');
  assert.equal(t.starts_on, '2026-11-14');
  assert.equal(t.start_time, '07:56');
  assert.equal(t.notes, 'TGV INOUI 6603 · arrivée 09:52');
});

test('Booking.com : hôtel, arrivée, départ', () => {
  const mail = `Booking.com
Your booking is confirmed
Hotel Alfama Lisbon
Confirmation number: 4182.553.019
Check-in: Tuesday, May 8, 2027 from 15:00
Check-out: Saturday, May 15, 2027 until 11:00`;
  const [h] = parseBookingEmail(mail, TODAY);
  assert.equal(h.kind, 'hebergement');
  assert.equal(h.title, 'Hotel Alfama Lisbon');
  assert.equal(h.reference, '4182.553.019');
  assert.equal(h.starts_on, '2027-05-08');
  assert.equal(h.start_time, '15:00');
  assert.equal(h.notes, 'Départ le 15/05/2027');
});

test('Airbnb : logement en français', () => {
  const mail = `Réservation confirmée !
Appartement lumineux à Alfama
Arrivée : mar. 8 mai 2027, 15:00
Départ : sam. 15 mai 2027, 11:00
Code de confirmation HMABC12345`;
  const [h] = parseBookingEmail(mail, TODAY);
  assert.equal(h.kind, 'hebergement');
  assert.equal(h.title, 'Appartement lumineux à Alfama');
  assert.equal(h.starts_on, '2027-05-08');
  assert.equal(h.start_time, '15:00');
  assert.equal(h.reference, 'HMABC12345');
});

test('rien de reconnaissable : aucune réservation', () => {
  assert.deepEqual(parseBookingEmail('Bonjour, à bientôt !', TODAY), []);
  assert.deepEqual(parseBookingEmail('   ', TODAY), []);
});
