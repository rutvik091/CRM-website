/**
 * Utility functions for formatting, currency (INR), and contact actions
 */

export function formatINR(amount: number | string | undefined): string {
  if (amount === undefined || amount === null || amount === '') return '₹ 0';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₹ 0';
  return `₹ ${num.toLocaleString('en-IN')}`;
}

export function formatDateIST(dateStr: string | undefined): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = String(d.getDate()).padStart(2, '0');
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return dateStr;
  }
}

export function cleanIndianMobile(mobile: string): string {
  if (!mobile) return '';
  return mobile.replace(/\D/g, '').slice(-10);
}

export function openPhoneCall(mobile: string) {
  const clean = cleanIndianMobile(mobile);
  if (!clean) return;
  window.location.href = `tel:+91${clean}`;
}

export function openWhatsAppChat(mobile: string, customText?: string) {
  const clean = cleanIndianMobile(mobile);
  if (!clean) return;
  const encoded = customText ? encodeURIComponent(customText) : encodeURIComponent('Hello, contacting you regarding your portfolio with My Investment Manager.');
  const url = `https://wa.me/91${clean}?text=${encoded}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback
    const input = document.createElement('input');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(input);
    return ok;
  }
}
