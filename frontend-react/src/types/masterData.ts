export type MasterCategory = "activity_type" | "device_type" | "location";

export interface MasterDataItem {
  id: number;
  category: MasterCategory | string;
  value: string;
  active: boolean;
}
