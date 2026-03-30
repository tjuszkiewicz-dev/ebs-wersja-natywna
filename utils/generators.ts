
// Security & Utility Generators

// Cryptographically Secure Random Generator for Passwords
export const generateSecurePassword = (length = 12): string => {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  const array = new Uint32Array(length);
  // Fallback for environments where crypto might not be available (though unlikely in modern browsers)
  if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(array);
  } else {
      return Math.random().toString(36).slice(-length);
  }
  
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[array[i] % charset.length];
  }
  return result;
};

// UUID v4 Generator
export const generateUUID = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for non-secure contexts
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};
