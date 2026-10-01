import React from 'react';

interface OfflineIndicatorProps {
  totalTerms?: number;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = () => {
  // Uygulama doğası gereği çevrimdışı (offline) çalışmak üzere tasarlandığından
  // ekranın altındaki menüyü kapatan sarı uyarı kutusu kaldırıldı.
  return null;
};
