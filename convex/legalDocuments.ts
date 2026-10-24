import { query } from "./_generated/server";
import { v } from "convex/values";
import { getLegalDocuments, type LegalDocument } from "../lib/legal-documents";
import { getSellerInfo } from "../lib/store-config";
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
    const settings = await readStoreSettings(ctx);
    const documents = getLegalDocuments(getSellerInfo(settings));
    return {
      distanceSalesAgreement: checkoutMeta(documents.distanceSalesAgreement),
      preInformationForm: checkoutMeta(documents.preInformationForm),
    };
  },
});
