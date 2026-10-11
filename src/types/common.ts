/** One page of a paginated list endpoint. */
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** A person, as embedded in other records. */
export interface Person {
  id: string;
  full_name: string;
  email: string;
}

/** An id with a display name -- a compact reference to a block. */
export interface Ref {
  id: string;
  name: string;
}
