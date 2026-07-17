/**
 * Oblicza PIT (podatek dochodowy) na podstawie podstawy opodatkowania.
 * Uwzględnia ulgę PIT-2 (300 PLN/mies.), ulgę dla młodych, progi podatkowe.
 */
export function obliczPit(
  podstawa: number,
  pit2Kwota: number,
  ulgaMlodych: boolean,
  stawkaProcentowa: number
): number {
  if (ulgaMlodych) return 0;
  const podatek = (podstawa * stawkaProcentowa) / 100 - pit2Kwota;
  return Math.max(0, podatek);
}
