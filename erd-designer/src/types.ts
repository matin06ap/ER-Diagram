export interface Attribute {
  id: string;
  name: string;
  type: string;
  pk: boolean;
  fk: boolean;
  nullable: boolean;
  unique: boolean;
}

export interface Table {
  id: string;
  name: string;
  attributes: Attribute[];
  x: number;
  y: number;
}

export interface Relationship {
  id: string;
  t1: string; // Table 1 ID
  t2: string; // Table 2 ID
  name: string;
  cardinality: string;
  mx: number | null; // Dragged diamond x position
  my: number | null; // Dragged diamond y position
  attributes?: Attribute[];
  total1?: boolean;
  total2?: boolean;
}
