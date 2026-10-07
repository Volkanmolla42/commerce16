import { query } from "./_generated/server";
import { v } from "convex/values";
import { getCheckoutLegalDocuments } from "../lib/legal-documents";

const documentValidator = v.object({
  title: v.string(),
  slug: v.string(),
  version: v.string(),
  ready: v.boolean(),
});

export const getCheckoutDocuments = query({
  args: {},
  returns: v.object({
    distanceSalesAgreement: documentValidator,
    preInformationForm: documentValidator,
  }),
  handler: () => {
    const { distanceSalesAgreement, preInformationForm } = getCheckoutLegalDocuments();
    return {
      distanceSalesAgreement: {
        title: distanceSalesAgreement.title,
        slug: distanceSalesAgreement.slug,
        version: distanceSalesAgreement.version,
        ready: distanceSalesAgreement.ready,
      },
      preInformationForm: {
        title: preInformationForm.title,
        slug: preInformationForm.slug,
        version: preInformationForm.version,
        ready: preInformationForm.ready,
      },
    };
  },
});
