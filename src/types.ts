export interface WaterFeatureProperties {
  id: string;
  date: string;
  time: string;
  description: string;
  track: string;
  type: string;
  diameter: number;
  length: number;
  joint: boolean | null;
}
