/**
 * Utility for retrying AI calls with exponential backoff
 */
export async function retryAI<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries <= 0) throw error;
    
    // Check if it's a transient error (500, 503, 429, or XHR error)
    const errorStr = String(error).toLowerCase() + JSON.stringify(error).toLowerCase();
    const isTransient = 
      errorStr.includes('500') || 
      errorStr.includes('503') || 
      errorStr.includes('429') || 
      errorStr.includes('xhr error') ||
      errorStr.includes('proxy') ||
      errorStr.includes('timeout') ||
      errorStr.includes('rpc failed') ||
      errorStr.includes('resource_exhausted');

    if (isTransient) {
      console.warn(`AI call failed, retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryAI(fn, retries - 1, delay * 2);
    }
    
    throw error;
  }
}
