// Catégories de lieux (filtres de la carte) et requêtes OpenStreetMap associées.
export const CATEGORIES = [
  {
    id: 'restaurants',
    label: 'Restaurants',
    icon: 'utensils',
    color: '#E8793A',
    query: ['nwr["amenity"~"^(restaurant|cafe|fast_food|ice_cream)$"]["name"]'],
  },
  {
    id: 'loisirs',
    label: 'Loisirs & enfants',
    icon: 'face-smile',
    color: '#2E9E6A',
    query: [
      'nwr["leisure"~"^(park|playground|water_park|garden|indoor_play)$"]["name"]',
      'nwr["tourism"~"^(zoo|theme_park|aquarium)$"]["name"]',
      'nwr["amenity"~"^(cinema|theatre)$"]["name"]',
    ],
  },
  {
    id: 'shopping',
    label: 'Shopping',
    icon: 'bag-shopping',
    color: '#9B59B6',
    query: [
      'nwr["shop"~"^(mall|department_store|toys|books|gift)$"]["name"]',
      'nwr["amenity"="marketplace"]["name"]',
    ],
  },
  {
    id: 'monuments',
    label: 'Monuments',
    icon: 'landmark',
    color: '#C0392B',
    query: [
      'nwr["historic"~"^(monument|castle|memorial|fort|palace|church|cathedral)$"]["name"]',
      'nwr["tourism"~"^(attraction|viewpoint)$"]["name"]',
    ],
  },
  {
    id: 'musees',
    label: 'Musées',
    icon: 'palette',
    color: '#2C6FB7',
    query: ['nwr["tourism"~"^(museum|gallery)$"]["name"]'],
  },
  {
    id: 'pluie',
    label: 'Abri pluie',
    icon: 'umbrella',
    color: '#00A3E0',
    query: [
      'nwr["tourism"~"^(museum|aquarium|gallery)$"]["name"]',
      'nwr["amenity"~"^(cinema|library|theatre)$"]["name"]',
      'nwr["shop"~"^(mall|department_store)$"]["name"]',
      'nwr["leisure"="indoor_play"]["name"]',
    ],
  },
  {
    id: 'sante',
    label: 'Santé',
    icon: 'kit-medical',
    color: '#D64545',
    query: [
      'nwr["amenity"="hospital"]["name"]',
      'nwr["amenity"="pharmacy"]',
      'nwr["amenity"="clinic"]["name"]',
    ],
  },
];

export const categoryById = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[1];

export const STATUS = {
  todo: { label: 'À faire', icon: 'circle', color: '#6B7480' },
  visited: { label: 'Visité', icon: 'circle-check', color: '#2E9E6A' },
};
