export type Category = 'High-protein' | 'Bowls' | 'Wraps' | 'Salads' | 'Breakfast' | 'Soups' | 'Sips';

export interface Dish {
  id: string;
  slug: string;
  name: string;
  category: Category;
  kitchen: 'Indian' | 'Asian' | 'Continental' | 'Mediterranean';
  description: string;
  ingredients: string[];
  price: number;
  protein: number;
  calories: number;
  fiber: number;
  isVeg: boolean;
  badge?: string;
  color: string;
  wash: string;
}

export const dishes: Dish[] = [
  { id: 'd1', slug: 'grilled-chicken-veggies-mash', name: 'Grilled Chicken with Veggies & Mash', category: 'High-protein', kitchen: 'Continental', description: 'Herb-grilled chicken, silky potato mash and sautéed greens.', ingredients: ['150 g grilled chicken', 'Potato mash', 'Seasonal greens', 'Cold-pressed olive oil'], price: 299, protein: 42, calories: 518, fiber: 8, isVeg: false, badge: 'Bestseller', color: '#b8733c', wash: '#e2c6a0' },
  { id: 'd2', slug: 'chicken-meal-rice', name: 'Chicken Meal — 150 g grilled chicken + rice', category: 'High-protein', kitchen: 'Indian', description: 'A generous grilled chicken plate with turmeric rice and crisp vegetables.', ingredients: ['150 g chicken breast', 'Turmeric basmati rice', 'Carrot & beans', 'Mint yogurt'], price: 299, protein: 39, calories: 484, fiber: 7, isVeg: false, badge: 'RD pick', color: '#c76537', wash: '#e7cfaa' },
  { id: 'd3', slug: 'stuffed-chicken-beans-mash', name: 'Stuffed Chicken with Beans & Mash', category: 'High-protein', kitchen: 'Continental', description: 'Chicken breast filled with spinach, alongside green beans and mash.', ingredients: ['Chicken breast', 'Wilted spinach', 'Green beans', 'Potato mash'], price: 299, protein: 41, calories: 506, fiber: 9, isVeg: false, badge: 'New', color: '#78904f', wash: '#d8cfaa' },
  { id: 'd4', slug: 'grilled-paneer-sauteed-veg', name: 'Grilled Paneer with Sautéed Veg', category: 'High-protein', kitchen: 'Indian', description: 'Charred paneer, colourful vegetables and a bright coriander dressing.', ingredients: ['120 g fresh paneer', 'Bell peppers', 'Zucchini', 'Coriander dressing'], price: 199, protein: 24, calories: 438, fiber: 8, isVeg: true, color: '#d18a46', wash: '#e6d4a9' },
  { id: 'd5', slug: 'chicken-burrito-bowl', name: 'Chicken Burrito Bowl', category: 'Bowls', kitchen: 'Mediterranean', description: 'Smoky chicken, brown rice, beans and pico with your choice of sauce.', ingredients: ['Grilled chicken', 'Brown rice', 'Black beans', 'Pico de gallo'], price: 299, protein: 37, calories: 562, fiber: 12, isVeg: false, badge: 'Choose your sauce', color: '#a94933', wash: '#e5c29c' },
  { id: 'd6', slug: 'paneer-burrito-bowl', name: 'Paneer Burrito Bowl', category: 'Bowls', kitchen: 'Indian', description: 'Crisp paneer, herbed rice and beans finished with a smoky chipotle sauce.', ingredients: ['Grilled paneer', 'Herbed rice', 'Black beans', 'Chipotle sauce'], price: 249, protein: 27, calories: 548, fiber: 11, isVeg: true, color: '#c56e34', wash: '#e2cba4' },
  { id: 'd7', slug: 'quinoa-khichdi', name: 'Quinoa Khichdi', category: 'Bowls', kitchen: 'Indian', description: 'Comforting quinoa and moong lentils with vegetables, ghee and a gentle spice warmth.', ingredients: ['Quinoa', 'Yellow moong dal', 'Carrot & peas', 'Cultured ghee'], price: 179, protein: 18, calories: 402, fiber: 10, isVeg: true, badge: 'Comfort food', color: '#b99853', wash: '#ded0a8' },
  { id: 'd8', slug: 'peri-peri-chicken-wrap', name: 'Peri Peri Chicken Wrap', category: 'Wraps', kitchen: 'Asian', description: 'Tender chicken, crunchy slaw and peri peri yogurt in a soft whole-wheat wrap.', ingredients: ['Chicken breast', 'Whole-wheat wrap', 'Cabbage slaw', 'Peri peri yogurt'], price: 229, protein: 31, calories: 451, fiber: 7, isVeg: false, color: '#bc4938', wash: '#e4c2a5' },
  { id: 'd9', slug: 'mediterranean-chickpea-salad', name: 'Mediterranean Chickpea Salad', category: 'Salads', kitchen: 'Mediterranean', description: 'Chickpeas, cucumber and feta under a lemon-herb dressing.', ingredients: ['Chickpeas', 'Cucumber', 'Cherry tomato', 'Feta & lemon'], price: 219, protein: 16, calories: 389, fiber: 13, isVeg: true, badge: 'Fresh today', color: '#84964e', wash: '#d9d8ae' },
  { id: 'd10', slug: 'masala-egg-breakfast', name: 'Masala Egg Breakfast', category: 'Breakfast', kitchen: 'Indian', description: 'Soft masala eggs, multigrain toast and a fresh tomato-cucumber kachumber.', ingredients: ['Two eggs', 'Multigrain toast', 'Tomato kachumber', 'Mint chutney'], price: 189, protein: 19, calories: 365, fiber: 6, isVeg: false, badge: 'Morning ritual', color: '#d09337', wash: '#ead6aa' },
  { id: 'd11', slug: 'roasted-tomato-soup', name: 'Roasted Tomato & Basil Soup', category: 'Soups', kitchen: 'Continental', description: 'Slow-roasted tomatoes, basil and a little cream. Nothing from a packet.', ingredients: ['Roasted tomato', 'Fresh basil', 'A2 cream', 'Sourdough crumb'], price: 159, protein: 6, calories: 244, fiber: 5, isVeg: true, color: '#b94f3d', wash: '#e4c4ad' },
  { id: 'd12', slug: 'mango-turmeric-cooler', name: 'Mango Turmeric Cooler', category: 'Sips', kitchen: 'Indian', description: 'Alphonso mango, turmeric, lime and a pinch of black pepper over ice.', ingredients: ['Alphonso mango', 'Turmeric', 'Fresh lime', 'Black pepper'], price: 149, protein: 2, calories: 172, fiber: 3, isVeg: true, badge: 'No added sugar', color: '#d69c35', wash: '#e8d5a2' },
];

export const categories: Array<'All' | Category> = ['All', 'High-protein', 'Bowls', 'Wraps', 'Salads', 'Breakfast', 'Soups', 'Sips'];
export const findDish = (slug: string) => dishes.find((dish) => dish.slug === slug);
export const formatPrice = (value: number) => `₹${value.toLocaleString('en-IN')}`;