import assert from "node:assert/strict";
import { test } from "vitest";
import { getCheckoutDetails } from "./checkout-details";

const profile = { name: "Profil Adı", email: "customer@example.com", phone: "05000000000" };
const home = {
  _id: "home", isDefault: false, fullName: "Ev Alıcısı", phone: "05111111111",
  city: "İstanbul", district: "Kadıköy", addressLine1: "Moda Cad.",
};
const work = { ...home, _id: "work", isDefault: true, fullName: "İş Alıcısı", addressLine2: "Kat 2" };

test("loading defaults resolve when profile and addresses arrive", () => {
  const initial = getCheckoutDetails({ profile: undefined, addresses: undefined, selection: null, draft: {} });
  assert.equal(initial.customerName, "");
  assert.equal(initial.selectedAddressId, "custom");
  const loaded = getCheckoutDetails({ profile, addresses: [home, work], selection: null, draft: {} });
  assert.equal(loaded.selectedAddressId, "work");
  assert.equal(loaded.customerName, work.fullName);
  assert.equal(loaded.customerEmail, profile.email);
  assert.equal(loaded.addressLine, "Moda Cad., Kat 2");
});

test("explicit custom address stays custom after saved addresses load", () => {
  const details = getCheckoutDetails({ profile, addresses: [home, work], selection: "custom", draft: { city: "Rize" } });
  assert.equal(details.selectedAddressId, "custom");
  assert.equal(details.customerName, profile.name);
  assert.equal(details.city, "Rize");
  assert.equal(details.addressLine, "");
});

test("edits, including cleared inputs, survive server default updates", () => {
  const details = getCheckoutDetails({ profile, addresses: [work], selection: null,
    draft: { customerName: "", phone: "", customerEmail: "new@example.com" } });
  assert.equal(details.customerName, "");
  assert.equal(details.phone, "");
  assert.equal(details.customerEmail, "new@example.com");
});

test("explicit selection takes precedence and removed addresses fall back to custom", () => {
  const selected = getCheckoutDetails({ profile, addresses: [home, work], selection: "home", draft: {} });
  assert.equal(selected.selectedAddressId, "home");
  assert.equal(selected.customerName, home.fullName);
  const removed = getCheckoutDetails({ profile, addresses: [work], selection: "home", draft: {} });
  assert.equal(removed.selectedAddressId, "custom");
  assert.equal(removed.city, "");
  assert.equal(removed.customerName, profile.name);
});
