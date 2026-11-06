// Catégories de lieux (filtres de la carte) et requêtes OpenStreetMap associées.
export const CATEGORIES = [
  {
    id: 'restaurants',
    label: 'Restaurants',
    icon: 'utensils',
    color: '#FF8A3D',
    query: ['nwr["amenity"~"^(restaurant|cafe|fast_food|ice_cream)$"]["name"]'],
    subs: [
      { id: 'boulangerie', label: 'Boulangerie', icon: 'bread-slice', google: ['bakery'], osm: ['nwr["shop"~"^(bakery|pastry)$"]'] },
      { id: 'pizzeria', label: 'Pizzeria', icon: 'pizza-slice', google: ['pizza_restaurant'], osm: ['nwr["cuisine"~"pizza"]["name"]'] },
      { id: 'kebab', label: 'Kebab', icon: 'drumstick-bite', text: 'kebab', osm: ['nwr["cuisine"~"kebab"]["name"]'] },
      { id: 'mcdo', label: "McDo", icon: 'burger', text: "McDonald's", osm: ['nwr["brand"~"McDonald"]', 'nwr["name"~"McDonald"]'] },
      { id: 'burger', label: 'Burger', icon: 'burger', google: ['hamburger_restaurant'], osm: ['nwr["cuisine"~"burger"]["name"]'] },
      { id: 'fastfood', label: 'Fast-food', icon: 'hotdog', google: ['fast_food_restaurant'], osm: ['nwr["amenity"="fast_food"]["name"]'] },
      { id: 'cafe', label: 'Café & goûter', icon: 'mug-hot', google: ['cafe', 'coffee_shop', 'tea_house'], osm: ['nwr["amenity"="cafe"]["name"]'] },
      { id: 'glace', label: 'Glacier', icon: 'ice-cream', google: ['ice_cream_shop', 'dessert_shop'], osm: ['nwr["amenity"="ice_cream"]', 'nwr["shop"="ice_cream"]'] },
      { id: 'brunch', label: 'Brunch', icon: 'egg', google: ['brunch_restaurant', 'breakfast_restaurant'], osm: ['nwr["cuisine"~"breakfast|brunch"]["name"]'] },
      { id: 'italien', label: 'Italien', icon: 'wheat-awn', google: ['italian_restaurant'], osm: ['nwr["cuisine"~"italian"]["name"]'] },
      { id: 'asiatique', label: 'Asiatique', icon: 'bowl-rice', google: ['chinese_restaurant', 'japanese_restaurant', 'thai_restaurant', 'sushi_restaurant', 'ramen_restaurant'], osm: ['nwr["cuisine"~"chinese|japanese|thai|sushi|asian|ramen"]["name"]'] },
      { id: 'indien', label: 'Indien', icon: 'pepper-hot', google: ['indian_restaurant'], osm: ['nwr["cuisine"~"indian"]["name"]'] },
      { id: 'fishchips', label: 'Fish & chips', icon: 'fish', text: 'fish and chips', osm: ['nwr["cuisine"~"fish_and_chips"]["name"]'] },
      { id: 'vegetarien', label: 'Végétarien', icon: 'leaf', google: ['vegetarian_restaurant', 'vegan_restaurant'], osm: ['nwr["diet:vegetarian"~"yes|only"]["name"]'] },
    ],
  },
  {
    id: 'loisirs',
    label: 'Loisirs & enfants',
    icon: 'face-smile',
    color: '#22B07D',
    query: [
      'nwr["leisure"~"^(park|playground|water_park|garden|indoor_play)$"]["name"]',
      'nwr["tourism"~"^(zoo|theme_park|aquarium)$"]["name"]',
      'nwr["amenity"~"^(cinema|theatre)$"]["name"]',
    ],
    subs: [
      { id: 'jeux', label: 'Aires de jeux', icon: 'child-reaching', google: ['playground'], osm: ['nwr["leisure"="playground"]'] },
      { id: 'parcs', label: 'Parcs', icon: 'tree', google: ['park', 'garden'], osm: ['nwr["leisure"~"^(park|garden)$"]["name"]'] },
      { id: 'zoo', label: 'Zoo & aquarium', icon: 'fish-fins', google: ['zoo', 'aquarium'], osm: ['nwr["tourism"~"^(zoo|aquarium)$"]["name"]'] },
      { id: 'cinema', label: 'Cinéma', icon: 'film', google: ['movie_theater'], osm: ['nwr["amenity"="cinema"]["name"]'] },
      { id: 'spectacle', label: 'Spectacles', icon: 'masks-theater', google: ['performing_arts_theater'], osm: ['nwr["amenity"="theatre"]["name"]'] },
      { id: 'manege', label: "Parcs d'attractions", icon: 'ticket', google: ['amusement_park', 'amusement_center'], osm: ['nwr["tourism"="theme_park"]["name"]', 'nwr["leisure"="amusement_arcade"]["name"]'] },
      { id: 'jouets', label: 'Magasins de jouets', icon: 'puzzle-piece', text: 'magasin de jouets', osm: ['nwr["shop"="toys"]["name"]'] },
    ],
  },
  {
    id: 'shopping',
    label: 'Shopping',
    icon: 'bag-shopping',
    color: '#A66BFF',
    query: [
      'nwr["shop"~"^(mall|department_store|toys|books|gift)$"]["name"]',
      'nwr["amenity"="marketplace"]["name"]',
    ],
  },
  {
    id: 'monuments',
    label: 'Monuments',
    icon: 'landmark',
    color: '#E5484D',
    query: [
      'nwr["historic"~"^(monument|castle|memorial|fort|palace|church|cathedral)$"]["name"]',
      'nwr["tourism"~"^(attraction|viewpoint)$"]["name"]',
    ],
    subs: [
      { id: 'incontournables', label: 'Incontournables', icon: 'star', google: ['tourist_attraction'], osm: ['nwr["tourism"="attraction"]["name"]'] },
      { id: 'chateaux', label: 'Châteaux & palais', icon: 'chess-rook', google: ['castle', 'palace'], osm: ['nwr["historic"~"^(castle|palace|fort)$"]["name"]'] },
      { id: 'eglises', label: 'Églises', icon: 'church', google: ['church', 'place_of_worship'], osm: ['nwr["building"~"^(church|cathedral)$"]["name"]', 'nwr["amenity"="place_of_worship"]["name"]["historic"]'] },
      { id: 'vues', label: 'Points de vue', icon: 'binoculars', google: ['observation_deck'], osm: ['nwr["tourism"="viewpoint"]'] },
      { id: 'statues', label: 'Statues & monuments', icon: 'monument', google: ['monument', 'sculpture'], osm: ['nwr["historic"~"^(monument|memorial)$"]["name"]'] },
    ],
  },
  {
    id: 'musees',
    label: 'Musées',
    icon: 'palette',
    color: '#3E7BFA',
    query: ['nwr["tourism"~"^(museum|gallery)$"]["name"]'],
  },
  {
    id: 'pluie',
    label: 'Abri pluie',
    icon: 'umbrella',
    color: '#14B8C4',
    query: [
      'nwr["tourism"~"^(museum|aquarium|gallery)$"]["name"]',
      'nwr["amenity"~"^(cinema|library|theatre)$"]["name"]',
      'nwr["shop"~"^(mall|department_store)$"]["name"]',
      'nwr["leisure"="indoor_play"]["name"]',
    ],
  },
  {
    id: 'pratique',
    label: 'Pratique',
    icon: 'circle-info',
    color: '#5B6B7F',
    query: ['nwr["amenity"~"^(atm|toilets|bureau_de_change)$"]', 'nwr["shop"~"^(supermarket|convenience)$"]["name"]'],
    subs: [
      { id: 'atm', label: 'Distributeurs', icon: 'money-bill-wave', google: ['atm'], osm: ['nwr["amenity"="atm"]', 'nwr["amenity"="bank"]["atm"="yes"]'] },
      { id: 'toilettes', label: 'Toilettes', icon: 'restroom', google: ['public_bathroom'], osm: ['nwr["amenity"="toilets"]'] },
      { id: 'courses', label: 'Supermarchés', icon: 'cart-shopping', google: ['supermarket', 'grocery_store', 'convenience_store'], osm: ['nwr["shop"~"^(supermarket|convenience)$"]["name"]'] },
      { id: 'change', label: 'Bureau de change', icon: 'money-bill-transfer', text: 'bureau de change', osm: ['nwr["amenity"="bureau_de_change"]'] },
      { id: 'metro', label: 'Métro & gares', icon: 'train-subway', google: ['subway_station', 'train_station'], osm: ['nwr["railway"="station"]["name"]', 'nwr["station"="subway"]["name"]'] },
      { id: 'bebe', label: 'Change bébé', icon: 'baby', text: 'baby changing room', osm: ['nwr["changing_table"="yes"]'] },
      { id: 'pharmacie', label: 'Pharmacies', icon: 'prescription-bottle-medical', google: ['pharmacy', 'drugstore'], osm: ['nwr["amenity"="pharmacy"]'] },
    ],
  },
  {
    id: 'sante',
    label: 'Santé',
    icon: 'kit-medical',
    color: '#F04438',
    query: [
      'nwr["amenity"="hospital"]["name"]',
      'nwr["amenity"="pharmacy"]',
      'nwr["amenity"="clinic"]["name"]',
    ],
  },
];

export const categoryById = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[1];
export const subById = (catId, subId) => categoryById(catId).subs?.find((s) => s.id === subId) || null;

export const STATUS = {
  todo: { label: 'À faire', icon: 'circle', color: '#6B7480' },
  visited: { label: 'Visité', icon: 'circle-check', color: '#22B07D' },
};
