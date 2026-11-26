import {notFound} from 'next/navigation';
import MealHistory from '@/components/MealHistory';
import {mealHistoryEnabled} from '@/lib/meal-history/model';

export default function MealHistoryPage() {
  if (!mealHistoryEnabled) notFound();
  return <MealHistory />;
}
