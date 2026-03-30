import { redirect } from 'next/navigation';

// Strona główna — przekieruj na login (middleware obsługuje auth redirect)
export default function HomePage() {
  redirect('/login');
}
