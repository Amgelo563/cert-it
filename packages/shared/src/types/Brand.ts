declare const BrandKey: unique symbol;

/** A type made distinct from its base type, such as an ID that can't be mixed up with the IDs of other models. */
export type Brand<T, Name extends string> = T & { readonly [BrandKey]: Name };
