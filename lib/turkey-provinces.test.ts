import { describe, expect, it } from "vitest";
import {
  TURKEY_PROVINCES,
  getProvinceById,
  getProvinceByName,
  getDistrictById,
  getDistrictByName,
} from "./turkey-provinces";

describe("turkey-provinces", () => {
  it("contains all 81 provinces", () => {
    expect(TURKEY_PROVINCES).toHaveLength(81);
    expect(TURKEY_PROVINCES[0].name).toBe("Adana");
    expect(TURKEY_PROVINCES[80].name).toBe("Düzce");
  });

  describe("getProvinceById", () => {
    it("returns province for valid id", () => {
      const istanbul = getProvinceById("34");
      expect(istanbul?.name).toBe("İstanbul");
      expect(istanbul?.districts.length).toBeGreaterThan(0);
    });

    it("returns undefined for invalid or undefined id", () => {
      expect(getProvinceById("999")).toBeUndefined();
      expect(getProvinceById(undefined)).toBeUndefined();
    });
  });

  describe("getProvinceByName", () => {
    it("finds province case-insensitively with Turkish characters", () => {
      expect(getProvinceByName("istanbul")?.id).toBe("34");
      expect(getProvinceByName("İSTANBUL")?.id).toBe("34");
      expect(getProvinceByName("  İzmir  ")?.id).toBe("35");
      expect(getProvinceByName("ankara")?.id).toBe("6");
    });

    it("returns undefined for invalid or undefined name", () => {
      expect(getProvinceByName("Bilinmeyen")).toBeUndefined();
      expect(getProvinceByName(undefined)).toBeUndefined();
    });
  });

  describe("getDistrictById", () => {
    it("finds district by province and district id", () => {
      const kadikoy = getDistrictById("34", "1421");
      expect(kadikoy?.name).toBe("Kadıköy");
    });

    it("returns undefined for non-existent district", () => {
      expect(getDistrictById("34", "99999")).toBeUndefined();
      expect(getDistrictById(undefined, "1421")).toBeUndefined();
    });
  });

  describe("getDistrictByName", () => {
    it("finds district by name case-insensitively", () => {
      const cankaya = getDistrictByName("6", "çankaya");
      expect(cankaya?.id).toBe("1231");
    });

    it("returns undefined when name is invalid or missing", () => {
      expect(getDistrictByName("6", "Bilinmeyen")).toBeUndefined();
      expect(getDistrictByName("6", undefined)).toBeUndefined();
    });
  });
});
