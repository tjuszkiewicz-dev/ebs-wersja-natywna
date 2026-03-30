
// Central Utility for consistent formatting across the App

export const formatDate = (dateString: string | Date | undefined): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';
  
  return date.toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

export const formatDateTime = (dateString: string | Date | undefined): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';

  return date.toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatCurrency = (amount: number | undefined): string => {
  if (amount === undefined || amount === null) return '0,00 PLN';
  
  return amount.toLocaleString('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export const formatCompactCurrency = (amount: number): string => {
  return new Intl.NumberFormat('pl-PL', {
    notation: "compact",
    compactDisplay: "short"
  }).format(amount) + ' PLN';
};
