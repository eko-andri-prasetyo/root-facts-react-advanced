export const VEGETABLE_LABELS_ID = {
  Beetroot: 'bit',
  Paprika: 'paprika',
  Cabbage: 'kubis',
  Carrot: 'wortel',
  Cauliflower: 'kembang kol',
  Chilli: 'cabai',
  Corn: 'jagung',
  Cucumber: 'mentimun',
  eggplant: 'terong',
  Eggplant: 'terong',
  Garlic: 'bawang putih',
  Ginger: 'jahe',
  Lettuce: 'selada',
  Onion: 'bawang bombai',
  Peas: 'kacang polong',
  Potato: 'kentang',
  Turnip: 'lobak putih',
  Soybean: 'kedelai',
  Spinach: 'bayam',
};

export const VEGETABLE_ALIASES = {
  Beetroot: ['beetroot', 'bit', 'umbi bit'],
  Paprika: ['paprika', 'bell pepper'],
  Cabbage: ['cabbage', 'kubis', 'kol'],
  Carrot: ['carrot', 'wortel'],
  Cauliflower: ['cauliflower', 'kembang kol'],
  Chilli: ['chilli', 'chili', 'cabai', 'cabe'],
  Corn: ['corn', 'jagung'],
  Cucumber: ['cucumber', 'mentimun', 'timun'],
  eggplant: ['eggplant', 'terong'],
  Eggplant: ['eggplant', 'terong'],
  Garlic: ['garlic', 'bawang putih'],
  Ginger: ['ginger', 'jahe'],
  Lettuce: ['lettuce', 'selada'],
  Onion: ['onion', 'bawang bombai', 'bawang bombay'],
  Peas: ['peas', 'kacang polong'],
  Potato: ['potato', 'kentang'],
  Turnip: ['turnip', 'lobak putih', 'lobak'],
  Soybean: ['soybean', 'kedelai'],
  Spinach: ['spinach', 'bayam'],
};

export function getVegetableNameId(label) {
  return VEGETABLE_LABELS_ID[label] || String(label || 'sayuran').toLowerCase();
}

export function getVegetableAliases(label) {
  const displayName = getVegetableNameId(label);
  return VEGETABLE_ALIASES[label] || [String(label || '').toLowerCase(), displayName];
}
