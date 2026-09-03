/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * user.ts: The UniFi Access user account types, describing the authenticated user profile and the groups and roles it belongs to.
 */
import type { AccessKnownJsonValue, Nullable } from "./common.ts";

/**
 * The UniFi Access user account: the authenticated user's own profile, the group and role records it belongs to, and the permission and scope grants that decide what
 * it may do.
 *
 * @module AccessTypesUser
 */

/**
 * A description of a UniFi Access user group JSON, the organizational unit a user belongs to.
 */
export interface AccessUserGroupConfigInterface {

  create_time: string;
  name: string;
  system_name: string;
  unique_id: string;
  up_id: string;
  up_ids: string[];

  [key: string]: AccessKnownJsonValue;
}

/**
 * A description of a UniFi Access user role JSON, the named privilege level assigned to a user. `level` orders roles against each other, and `system_role` marks the
 * roles the controller ships rather than ones an administrator created.
 */
export interface AccessUserRoleConfigInterface {

  create_time: string;
  is_private: boolean;
  level: number;
  name: string;
  system_key: string;
  system_role: boolean;
  unique_id: string;
  update_time: string;

  [key: string]: AccessKnownJsonValue;
}

/**
 * A semi-complete description of the UniFi Access user JSON, as returned for the authenticated user.
 *
 * This document arrives unwrapped: the profile object is the entire response body, with none of the code and data envelope every other endpoint uses, so it is never
 * read through {@link AccessApiResponseInterface}.
 *
 * The trailing camelCase members are the odd ones out in an otherwise snake_case document. They arrive from the UniFi OS identity layer rather than from Access itself,
 * and they are preserved exactly as the wire spells them rather than normalized into the surrounding convention.
 */
export interface AccessUserConfigInterface {

  accessMask: number;
  alias: string;
  // Sent as `null` for a user with no picture, and the populated shape has not been observed, so the open JSON type admits whatever the controller sends.
  avatar: Nullable<AccessKnownJsonValue>;
  avatar_relative_path: string;
  avatar_rpath2: string;
  cloud_access_granted: boolean;
  create_time: number;
  email: string;
  email_is_null: boolean;
  email_status: string;
  employee_number: string;
  /* String-encoded booleans: the controller sends `"true"` and `"false"` as text here rather than as JSON booleans, so the honest type is a string map and a consumer
   * compares against the text. Despite sharing the name, this is a different shape from a device's or a location's extras and the types are deliberately not shared.
   */
  extras: Record<string, string>;
  first_name: string;
  full_name: string;
  groups: AccessUserGroupConfigInterface[];
  id: string;
  isMember: boolean;
  isOwner: boolean;
  isSuperAdmin: boolean;
  last_name: string;
  local_account_exist: boolean;
  login_time: number;
  maskedEmail: string;
  nfc_card_status: string;
  nfc_card_type: string;
  nfc_display_id: string;
  nfc_token: string;
  only_local_account: boolean;
  org_role: string;
  org_user_id: string;
  password_revision: number;
  permissionMask: number;
  // Keyed by dotted UniFi application domain, with the granted role names as the value.
  permissions: Record<string, string[]>;
  phone: string;
  role: string;
  roleId: string;
  roles: AccessUserRoleConfigInterface[];
  // The colon-delimited grant strings the identity layer issues, one per action the user may take.
  scopes: string[];
  sso_account: string;
  sso_picture: string;
  sso_username: string;
  sso_uuid: string;
  status: string;
  ucorePermission: {

    hasUpdateAndInstallPermission: boolean;
  };
  uid_account_status: string;
  uid_sso_account: string;
  uid_sso_id: string;
  unique_id: string;
  update_time: number;
  user_email: string;
  username: string;

  [key: string]: AccessKnownJsonValue;
}

/** @see {@link AccessUserConfigInterface} */
export type AccessUserConfig = AccessUserConfigInterface;

/** @see {@link AccessUserGroupConfigInterface} */
export type AccessUserGroupConfig = AccessUserGroupConfigInterface;

/** @see {@link AccessUserRoleConfigInterface} */
export type AccessUserRoleConfig = AccessUserRoleConfigInterface;
