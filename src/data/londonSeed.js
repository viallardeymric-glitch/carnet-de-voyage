// Voyage pré-rempli : Londres en famille, 27 → 30 décembre 2026.
export const LONDON_TRIP = {
  name: 'Noël à Londres en famille',
  city: { name: 'Londres', country: 'Royaume-Uni', countryCode: 'GB', currency: 'GBP', lat: 51.5072, lon: -0.1276 },
  startDate: '2026-12-27',
  endDate: '2026-12-30',
  lodging: {
    name: 'Premier Inn London Tower Bridge',
    address: '159 Tower Bridge Road, London SE1 3LP',
    lat: 51.4979,
    lon: -0.0794,
  },
  notes: 'Aller : avion Lyon → Gatwick puis Thameslink. Retour le 30 : train de 9h15 pour le vol de 12h15.',
};

// Idées de départ, rangées dans la boîte à idées (coordonnées approximatives).
export const LONDON_IDEAS = [
  { name: 'Natural History Museum (gratuit, dinosaures)', category: 'musees', lat: 51.4967, lon: -0.1764 },
  { name: 'Science Museum (gratuit, Wonderlab)', category: 'musees', lat: 51.4978, lon: -0.1745 },
  { name: 'London Transport Museum (gratuit -18 ans)', category: 'musees', lat: 51.5119, lon: -0.1215 },
  { name: 'SEA LIFE London Aquarium', category: 'pluie', lat: 51.5023, lon: -0.1192 },
  { name: 'Tower of London (joyaux de la couronne)', category: 'monuments', lat: 51.5081, lon: -0.0759 },
  { name: 'Tower Bridge', category: 'monuments', lat: 51.5055, lon: -0.0754 },
  { name: 'Borough Market (pause gourmande)', category: 'restaurants', lat: 51.5055, lon: -0.091 },
  { name: 'Hamleys (magasin de jouets)', category: 'shopping', lat: 51.5129, lon: -0.1403 },
  { name: 'Hyde Park Winter Wonderland', category: 'loisirs', lat: 51.5073, lon: -0.1573 },
  { name: 'Aire de jeux Diana Memorial (Kensington)', category: 'loisirs', lat: 51.5066, lon: -0.1874 },
  { name: 'Sky Garden (gratuit, réserver en ligne)', category: 'monuments', lat: 51.5113, lon: -0.0835 },
  { name: 'Covent Garden (illuminations, artistes de rue)', category: 'shopping', lat: 51.5117, lon: -0.1240 },
];
