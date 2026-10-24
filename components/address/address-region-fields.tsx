"use client";

import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { Label } from "@/components/ui/label";
import { getDistrictById, getProvinceById, TURKEY_PROVINCES } from "@/lib/turkey-provinces";

export type AddressRegionSelection = {
  provinceId: string;
  provinceName: string;
  districtId: string;
  districtName: string;
};

const VARIANT_CLASSES = {
  checkout: {
    field: "space-y-2",
    label: "text-sm font-medium text-foreground",
    select:
      "h-11 w-full appearance-none rounded-xl border border-input bg-background px-3.5 pr-10 text-base sm:text-sm font-normal text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 transition shadow-2xs",
    chevron: true,
  },
  account: {
    field: "space-y-2",
    label: "text-xs uppercase tracking-wider text-muted-foreground",
    select:
      "h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
    chevron: false,
  },
} as const;

export function AddressRegionFields({
  variant,
  idPrefix,
  provinceId,
  districtId,
  onChange,
  provinceLabel = "İl",
  districtLabel = "İlçe",
}: {
  variant: keyof typeof VARIANT_CLASSES;
  idPrefix: string;
  provinceId: string;
  districtId: string;
  onChange: (selection: AddressRegionSelection) => void;
  provinceLabel?: string;
  districtLabel?: string;
}) {
  const styles = VARIANT_CLASSES[variant];
  const province = getProvinceById(provinceId);
  const districts = [...(province?.districts ?? [])].sort((a, b) => a.name.localeCompare(b.name, "tr"));

  return (
    <>
      <div className={styles.field}>
        <Label htmlFor={`${idPrefix}-province`} className={styles.label}>
          {provinceLabel} <span className="text-destructive">*</span>
        </Label>
        <div className={styles.chevron ? "relative" : undefined}>
          <select
            id={`${idPrefix}-province`}
            required
            autoComplete="address-level1"
            value={provinceId}
            onChange={(event) => {
              const nextProvince = getProvinceById(event.target.value);
              onChange({
                provinceId: event.target.value,
                provinceName: nextProvince?.name ?? "",
                districtId: "",
                districtName: "",
              });
            }}
            className={styles.select}
          >
            <option value="" disabled>İl seçin</option>
            {TURKEY_PROVINCES.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          {styles.chevron && (
            <ChevronDownIcon className="pointer-events-none absolute right-3.5 top-3.5 size-4 text-muted-foreground" />
          )}
        </div>
      </div>

      <div className={styles.field}>
        <Label htmlFor={`${idPrefix}-district`} className={styles.label}>
          {districtLabel} <span className="text-destructive">*</span>
        </Label>
        <div className={styles.chevron ? "relative" : undefined}>
          <select
            id={`${idPrefix}-district`}
            required
            autoComplete="address-level2"
            value={districtId}
            disabled={!provinceId}
            onChange={(event) => {
              const nextDistrict = getDistrictById(provinceId, event.target.value);
              onChange({
                provinceId,
                provinceName: province?.name ?? "",
                districtId: event.target.value,
                districtName: nextDistrict?.name ?? "",
              });
            }}
            className={styles.select}
          >
            <option value="" disabled>{provinceId ? "İlçe seçin" : "Önce il seçin"}</option>
            {districts.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          {styles.chevron && (
            <ChevronDownIcon className="pointer-events-none absolute right-3.5 top-3.5 size-4 text-muted-foreground" />
          )}
        </div>
      </div>
    </>
  );
}
