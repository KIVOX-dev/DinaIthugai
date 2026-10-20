/**
 * The frontend fetches public data with `cache: "no-store"`, so there is no render cache to purge.
 * Hook kept as the single place to call a frontend revalidation webhook if ISR is introduced later.
 */
export async function invalidatePublic() {
  /* intentionally empty */
}
