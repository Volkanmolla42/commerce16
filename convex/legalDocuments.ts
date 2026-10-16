import { query } from "./_generated/server";
import { v } from "convex/values";
import { getLegalDocuments, type LegalDocument } from "../lib/legal-documents";
import { readStoreSettings } from "./settings";

const documentValidator = v.object({
  title: v.string(),
  slug: v.string(),
  version: v.string(),
  ready: v.boolean(),
});

function checkoutMeta({ title, slug, version, ready }: LegalDocument) {
  return { title, slug, version, ready };
}

export const getCheckoutDocuments = query({
  args: {},
  returns: v.object({
    distanceSalesAgreement: documentValidator,
    preInformationForm: documentValidator,
  }),
  handler: async (ctx) => {
    const { storeName, address, email, phone } = await readStoreSettings(ctx);
    const documents = getLegalDocuments({ storeName, address, email, phone });
    return {
      distanceSalesAgreement: checkoutMeta(documents.distanceSalesAgreement),
      preInformationForm: checkoutMeta(documents.preInformationForm),
    };
  },
});
