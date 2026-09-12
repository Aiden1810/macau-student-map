import {Dices, MapPin, Scissors, Search, Store, Utensils, Wine, Wrench, Star} from 'lucide-react';
import {getPlacePresentation, type PlaceTypeInput} from '@/lib/domain/place-types';

const icons = {restaurant: Utensils, scissors: Scissors, wine: Wine, dice: Dices, mystery: Search, shop: Store, service: Wrench, entertainment: Star, pin: MapPin};

export default function PlaceTypeBadge({place}: {place: PlaceTypeInput}) {
  const presentation = getPlacePresentation(place);
  const Icon = icons[presentation.icon];
  return <span className="inline-flex items-center gap-1 rounded-md border border-current/15 bg-white/80 px-2 py-0.5 text-xs font-medium" style={{color: presentation.color}}><Icon aria-hidden="true" className="h-3.5 w-3.5" />{presentation.label}</span>;
}
