import data from '../assets/data/skyscrapers.json';
import { IMAGES } from './images';

export const SKYSCRAPERS = data.map((s) => ({ ...s, image: IMAGES[s.id] }));

export const CATEGORIES = [
  { key: 'name', label: 'Name' },
  { key: 'country', label: 'Country' },
  { key: 'height', label: 'Height (meters)' },
  { key: 'floors', label: 'Floors' },
  { key: 'year', label: 'Year of construction' },
];

if (__DEV__) {
  const dataIds = new Set(data.map((s) => s.id));
  for (const s of data) {
    if (!IMAGES[s.id]) {
      console.warn(
        `[monolith] No image bundled for "${s.id}" — add one in src/images.js`,
      );
    }
  }
  for (const id of Object.keys(IMAGES)) {
    if (!dataIds.has(id)) {
      console.warn(
        `[monolith] Image bundled for "${id}" has no matching entry in assets/data/skyscrapers.json`,
      );
    }
  }
}
