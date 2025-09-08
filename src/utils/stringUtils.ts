/**
 * Normalizes a dish name by removing common food-related words and extra spaces
 * @param name The dish name to normalize
 * @returns The normalized dish name
 */
export const normalizeDishName = (name: string): string => {
  if (!name) return '';
  
  // Common food-related words to remove (case insensitive)
  const wordsToRemove = [
    'recipe', 'dish', 'meal', 'dinner', 'lunch', 'breakfast', 
    'food', 'cuisine', 'style', 'type', 'flavor', 'taste',
    // Preserve cooking method adjectives (e.g., fried/grilled/roasted/steamed/baked/cooked)
    'the', 'a', 'an', 'my', 'some', 'any', 'all', 'of', 'with',
    'and', 'or', 'for', 'in', 'on', 'at', 'to', 'from', 'by'
  ];
  
  // Convert to lowercase and split into words
  const words = name.toLowerCase().split(/\s+/);
  
  // Filter out common words and words that are just numbers or special chars
  const filteredWords = words.filter(word => {
    // Remove empty strings and words that are just numbers/special chars
    if (!word || /^[\d\W_]+$/.test(word)) return false;
    
    // Remove common food-related words
    return !wordsToRemove.includes(word);
  });
  
  // Join back with single spaces and trim
  let result = filteredWords.join(' ').trim();
  
  // Remove any remaining special characters except spaces and hyphens
  result = result.replace(/[^\w\s-]/g, '');
  
  // Replace multiple spaces with single space
  result = result.replace(/\s+/g, ' ');
  
  // Capitalize first letter of each word
  result = result.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
    
  return result || name; // Return original if result is empty
};

/**
 * Extracts the main dish name from a query string
 * @param query The search query
 * @returns The normalized dish name
 */
export const extractDishName = (query: string): string => {
  if (!query) return '';
  
  // Remove common phrases that might be in the query
  const cleaned = query
    .replace(/(can you )?(find|recommend|suggest|get me|give me|show me|i want|i'd like|i need)\s+/i, '')
    .replace(/(for|as|a|an|my|some|any|all|the|please|thanks|thank you|plz|pls)[\s.,!?]*$/i, '')
    .trim();
    
  return normalizeDishName(cleaned);
};
