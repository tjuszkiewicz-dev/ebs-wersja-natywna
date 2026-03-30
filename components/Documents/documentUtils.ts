export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('pl-PL');
};

export const formatCurrency = (amount: number): string => {
  return amount.toFixed(2) + ' PLN';
};

export const getDueDate = (dateStr: string, days: number = 7): string => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('pl-PL');
};

export const generateDocNumber = (type: string, id: string) => {
  return `${type}/${id}`;
};