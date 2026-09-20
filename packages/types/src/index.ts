export type ServiceName = 'web' | 'admin' | 'api' | 'worker';
export type * from './wallet.js';
export type * from './storefront.js';
export type * from './wallet-ledger.js';
export type CatalogMode = 'CONSUMER' | 'COIN';
export type MoneyUnit = 'USD' | 'COIN';
export interface CatalogBox {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image: string;
  mode: CatalogMode;
  category: string;
  tags: string[];
  displayOrder: number;
  completenessStatus: 'COMPLETE' | 'INCOMPLETE';
  priceMinor: string;
  price: string;
  priceUnit: MoneyUnit;
}
export interface CatalogBoxItem {
  id: string;
  name: string;
  image: string;
  displayOrder: number;
  displayValueMinor: string;
  displayValue: string;
  displayValueUnit: MoneyUnit;
  /** Reference display only. Not an Opening Engine configuration. */
  displayProbabilityPercent: string | null;
}
export interface CatalogList {
  boxes: CatalogBox[];
  page: number;
  pageSize: number;
  total: number;
}
export interface CatalogDetail {
  box: CatalogBox;
  items: CatalogBoxItem[];
  relatedBoxes: CatalogBox[];
}
export interface HealthResponse {
  status: 'ok' | 'error';
  service: ServiceName;
  checks?: Record<string, 'up' | 'down'>;
}
export const INFRASTRUCTURE_QUEUE = 'infrastructure';
export const HEALTHCHECK_JOB = 'healthcheck';
export interface AuthUser {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  createdAt: string;
}
