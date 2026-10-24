import config from "../store.config.json";

export const storeConfig = config;

export function getSellerInfo(contact: { email: string; phone: string }) {
  return {
    storeName: storeConfig.name,
    legalName: storeConfig.legalName,
    address: storeConfig.address,
    taxOffice: storeConfig.taxOffice,
    taxNumber: storeConfig.taxNumber,
    mersis: storeConfig.mersis,
    email: contact.email,
    phone: contact.phone,
  };
}

export function isLegalIdentityConfigured() {
  return [
    storeConfig.legalName,
    storeConfig.address,
    storeConfig.taxOffice,
    storeConfig.taxNumber,
  ].every((value) => value.trim().length > 0);
}
