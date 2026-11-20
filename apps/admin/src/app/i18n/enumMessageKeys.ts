/** The message key of each value of an enum object: its member name, uncapitalized, such as `changePassword` for `ChangePassword: 'change_password'`. */
export function enumMessageKeys<const Enum extends Record<string, string>>(
  values: Enum,
): Record<Enum[keyof Enum], Uncapitalize<keyof Enum & string>> {
  return Object.fromEntries(
    Object.entries(values).map(([name, value]) => [
      value,
      `${name.charAt(0).toLowerCase()}${name.slice(1)}`,
    ]),
  ) as Record<Enum[keyof Enum], Uncapitalize<keyof Enum & string>>;
}
