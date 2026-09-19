[**unifi-access**](../README.md)

***

[Home](../README.md) / AccessApiCode

# Type Alias: AccessApiCode

```ts
type AccessApiCode = 
  | "CODE_ACCESS_POLICY_HOLIDAY_GROUP_CAN_NOT_DELETE"
  | "CODE_ACCESS_POLICY_HOLIDAY_GROUP_NAME_EXIST"
  | "CODE_ACCESS_POLICY_HOLIDAY_GROUP_NOT_FOUND"
  | "CODE_ACCESS_POLICY_HOLIDAY_NAME_EXIST"
  | "CODE_ACCESS_POLICY_HOLIDAY_NOT_FOUND"
  | "CODE_ACCESS_POLICY_HOLIDAY_TIMEZONE_NOT_FOUND"
  | "CODE_ACCESS_POLICY_SCHEDULE_CAN_NOT_DELETE"
  | "CODE_ACCESS_POLICY_SCHEDULE_NAME_EXIST"
  | "CODE_ACCESS_POLICY_SCHEDULE_NOT_FOUND"
  | "CODE_ACCESS_POLICY_USER_TIMEZONE_NOT_FOUND"
  | "CODE_ACCESS_TOKEN_INVALID"
  | "CODE_AUTH_FAILED"
  | "CODE_CREDS_DISABLE_TRANSFER_UID_USER_NFC"
  | "CODE_CREDS_NFC_CARD_CANNOT_BE_DELETE"
  | "CODE_CREDS_NFC_CARD_INVALID"
  | "CODE_CREDS_NFC_CARD_IS_PROVISION"
  | "CODE_CREDS_NFC_CARD_PROVISION_FAILED"
  | "CODE_CREDS_NFC_HAS_BIND_USER"
  | "CODE_CREDS_NFC_READ_POLL_TOKEN_EMPTY"
  | "CODE_CREDS_NFC_READ_SESSION_NOT_FOUND"
  | "CODE_CREDS_PIN_CODE_CREDS_ALREADY_EXIST"
  | "CODE_CREDS_PIN_CODE_CREDS_LENGTH_INVALID"
  | "CODE_DEVICE_API_NOT_SUPPORTED"
  | "CODE_DEVICE_DEVICE_BUSY"
  | "CODE_DEVICE_DEVICE_NOT_FOUND"
  | "CODE_DEVICE_DEVICE_OFFLINE"
  | "CODE_DEVICE_DEVICE_VERSION_NOT_FOUND"
  | "CODE_DEVICE_DEVICE_VERSION_TOO_OLD"
  | "CODE_DEVICE_WEBHOOK_ENDPOINT_DUPLICATED"
  | "CODE_HOLIDAY_GROUP_CAN_NOT_DELETE"
  | "CODE_HOLIDAY_GROUP_CAN_NOT_EDIT"
  | "CODE_NOT_EXISTS"
  | "CODE_OPERATION_FORBIDDEN"
  | "CODE_OTHERS_UID_ADOPTED_NOT_SUPPORTED"
  | "CODE_PARAMS_INVALID"
  | "CODE_RESOURCE_NOT_FOUND"
  | "CODE_SPACE_DEVICE_BOUND_LOCATION_NOT_FOUND"
  | "CODE_SYSTEM_ERROR"
  | "CODE_UNAUTHORIZED"
  | "CODE_USER_ACCOUNT_NOT_EXIST"
  | "CODE_USER_CSV_IMPORT_INCOMPLETE_PROP"
  | "CODE_USER_EMAIL_ERROR"
  | "CODE_USER_NAME_DUPLICATED"
  | "CODE_USER_WORKER_NOT_EXISTS"
  | string & {
};
```

The controller's result-code vocabulary, spoken on both of its surfaces: every code the vendor's official reference documents, plus any code the controller sends
that the documentation does not list. The reference is where the vocabulary is written down, and the Access application's own endpoints answer out of it too -
the direct door-command refusal captured on 2026-09-16 came back as `CODE_SYSTEM_ERROR`, a listed member.

The open-string arm is what keeps the type honest in both directions. A closed union would be a claim that the documented set is the complete set, which no
capture in hand establishes - the reference has been caught understating the wire repeatedly - and an undocumented code would then be unrepresentable rather than
merely unfamiliar. Widening to `string` alone would give up the other half: the documented members stay listed, so they autocomplete, a `switch` over them
narrows, and a typo in one is a compile error rather than a comparison that silently never matches.

The success code is deliberately absent. It is the envelope's marker for "this is not an error at all", so it never reaches an error, and listing it here would
offer a value that cannot occur.
