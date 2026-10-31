// Leave an absent R:R out of the row so Postgres can apply the schema default.
// Closed trades are validated before save and therefore always provide a finite R:R.
export const serializedRr = value => value === '' || value == null ? {} : { rr:Number(value) };
