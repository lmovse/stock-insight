// lib/utils.ts - Utility functions

/**
 * Format date to YYYY/MM/DD format
 */
export function formatDate(dateString: string | undefined): string {
  if (!dateString) return '-';
  const d = new Date(dateString);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}
