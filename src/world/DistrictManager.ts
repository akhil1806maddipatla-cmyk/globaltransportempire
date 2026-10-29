export type DistrictCategory = 'logistics' | 'industrial' | 'commercial' | 'expansion' | 'rural';

export interface District {
  id: string;
  name: string;
  category: DistrictCategory;
  categoryLabel: string;
  description: string;
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  color: string;
}

export class DistrictManager {
  private districts: District[] = [
    {
      id: 'district_logistics_hub',
      name: 'Central Intermodal Logistics Yard',
      category: 'logistics',
      categoryLabel: 'Logistics Zone',
      description: 'Designated high-capacity redistribution sector with dedicated truck aprons and container storage.',
      bounds: { minX: 2, maxX: 18, minZ: 12, maxZ: 22 },
      color: '#df9a26',
    },
    {
      id: 'district_heavy_industry',
      name: 'Apex Manufacturing Quarter',
      category: 'industrial',
      categoryLabel: 'Heavy Industry Zone',
      description: 'Zoned for bulk processing, manufacturing assembly lines, and raw material transshipment.',
      bounds: { minX: 4, maxX: 12, minZ: 2, maxZ: 11 },
      color: '#e06a3b',
    },
    {
      id: 'district_commercial_hq',
      name: 'Regional Dispatch & Corporate Annex',
      category: 'commercial',
      categoryLabel: 'Commercial Zone',
      description: 'Commercial support facilities, freight brokerage offices, and logistics administration.',
      bounds: { minX: 13, maxX: 22, minZ: 2, maxZ: 11 },
      color: '#2b6cb0',
    },
    {
      id: 'district_expansion_north',
      name: 'North Sector Expansion Basin',
      category: 'expansion',
      categoryLabel: 'Development Reserve',
      description: 'Surveyed open terrain allocated for arterial road extensions and second-tier manufacturing.',
      bounds: { minX: 10, maxX: 22, minZ: 13, maxZ: 22 },
      color: '#10b981',
    },
    {
      id: 'district_northeast_tech',
      name: 'Northeast Industrial & Manufacturing Corridor',
      category: 'industrial',
      categoryLabel: 'Advanced Industry Zone',
      description: 'Heavy assembly facilities, high-tech manufacturing, and freight rail terminals.',
      bounds: { minX: 24, maxX: 42, minZ: 0, maxZ: 11 },
      color: '#0284c7',
    },
    {
      id: 'district_south_logistics',
      name: 'Southern Regional Distribution Park',
      category: 'logistics',
      categoryLabel: 'Regional Logistics Zone',
      description: 'High-cube fulfillment centers, cold-storage warehouses, and intermodal truck hubs.',
      bounds: { minX: 10, maxX: 26, minZ: 24, maxZ: 42 },
      color: '#f59e0b',
    },
    {
      id: 'district_maritime_port',
      name: 'Grand Harbor Maritime Logistics Hub',
      category: 'logistics',
      categoryLabel: 'Deepwater Seaport Zone',
      description: 'Container terminals, ship berthing quays, and maritime freight transshipment yards.',
      bounds: { minX: 27, maxX: 48, minZ: 12, maxZ: 36 },
      color: '#0ea5e9',
    },
    {
      id: 'district_delta_estuary',
      name: 'Southern Delta & Maritime Reserve',
      category: 'rural',
      categoryLabel: 'Eco-Marine Buffer',
      description: 'Scenic river delta, tidal flats, and agricultural raw material processing.',
      bounds: { minX: 10, maxX: 55, minZ: 43, maxZ: 55 },
      color: '#14b8a6',
    },
  ];

  public getDistrictAt(gridX: number, gridZ: number): District | null {
    for (const d of this.districts) {
      if (
        gridX >= d.bounds.minX &&
        gridX <= d.bounds.maxX &&
        gridZ >= d.bounds.minZ &&
        gridZ <= d.bounds.maxZ
      ) {
        return d;
      }
    }
    return null;
  }

  public getAllDistricts(): District[] {
    return [...this.districts];
  }
}
