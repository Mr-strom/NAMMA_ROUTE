export const calcFare = (distanceKm: number): number => {
  if (distanceKm <= 2) return 6;
  if (distanceKm <= 4) return 12;
  if (distanceKm <= 6) return 18;
  if (distanceKm <= 14) return 23;
  if (distanceKm <= 40) return 29;
  return 32;
};

export const calcAutoFare = (distanceKm: number): number => {
  return Math.round(30 + distanceKm * 15);
};

export const calcShaktiText = (fare: number): string => {
  return fare <= 0 ? "Shakti eligible" : "Shakti eligible";
};
