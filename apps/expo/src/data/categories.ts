// Catégories de lieux (table place_categories) : chargées une fois, partagées par tous les écrans.
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { EMPTY_CATEGORIES, buildCategories } from '../domain/categories.ts';
import type { Categories, Category } from '../domain/categories.ts';

export type { Categories, Category };

let cache: Promise<Categories> | null = null;

function load(): Promise<Categories> {
  if (!cache) {
    cache = (async () => {
      const { data, error } = await supabase.from('place_categories').select('code,kind,parent_code,name_fr,sort_order');
      if (error) { cache = null; return EMPTY_CATEGORIES; }
      return buildCategories((data ?? []) as Category[]);
    })();
  }
  return cache;
}

export function useCategories(): Categories {
  const [value, setValue] = useState<Categories>(EMPTY_CATEGORIES);
  useEffect(() => {
    let alive = true;
    void load().then((c) => { if (alive) setValue(c); });
    return () => { alive = false; };
  }, []);
  return value;
}
