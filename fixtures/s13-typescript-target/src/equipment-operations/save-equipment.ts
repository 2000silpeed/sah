import { writeEquipmentRecord as persistEquipment } from "../equipment-store.js";

export function saveEquipment(): void {
  persistEquipment();
}
