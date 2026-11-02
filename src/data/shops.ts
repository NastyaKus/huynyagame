export interface ShopDef {
  id: string;
  name: string;
  greeting: string;
  items: string[];
}

export const SHOPS: Record<string, ShopDef> = {
  konbini: {
    id: 'konbini',
    name: 'Комбини «Луна» · 24ч',
    greeting: 'Добро пожаловать… то есть, ирассяймасэ.',
    items: ['onigiri', 'tea', 'melonpan', 'energy', 'ramen', 'candy', 'pill', 'star_candy', 'fish_flakes', 'glowstick', 'cd_charm', 'denim'],
  },
  vending: {
    id: 'vending',
    name: 'Торговый автомат',
    greeting: '*гудит в тональности ми*',
    items: ['tea', 'energy'],
  },
};
